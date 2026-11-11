const Service = require('../../backend/services/Service.js')
const mqtt = require('mqtt')

// Bambu Lab printers over the LAN: each printer runs an MQTT broker on port
// 8883 (TLS with a self-signed certificate; user "bblp", password = the LAN
// access code from the printer's screen). The printer publishes its state on
// device/<serial>/report. X1/H2 send the full state each time, P1/A1 send only
// what changed, so reports are merged into one state per printer. A "pushall"
// request asks for the full state after connecting (P1 printers struggle if
// it is sent often, so only then and every 10 minutes).
//
// The widget only reads: no commands are ever sent to a printer besides
// pushall.

const PUSHALL_INTERVAL = 10*60*1000
const EMIT_THROTTLE = 2000      // reports can arrive every second while printing
const STALE_AFTER = 3*60*1000   // no report for this long: show the printer offline

// stg_cur: what the printer is doing within a print (from Bambu Studio)
const STAGES = {
  1: 'auto bed leveling', 2: 'heatbed preheating', 3: 'vibration compensation',
  4: 'changing filament', 5: 'M400 pause', 6: 'paused: filament runout',
  7: 'heating hotend', 8: 'calibrating extrusion', 9: 'scanning bed surface',
  10: 'inspecting first layer', 11: 'identifying build plate', 12: 'calibrating micro lidar',
  13: 'homing toolhead', 14: 'cleaning nozzle tip', 15: 'checking extruder temp',
  16: 'paused by user', 17: 'paused: front cover fell', 18: 'calibrating micro lidar',
  19: 'calibrating flow', 20: 'paused: nozzle temp error', 21: 'paused: bed temp error',
  22: 'unloading filament', 23: 'paused: skipped step', 24: 'loading filament',
  25: 'calibrating motor noise', 26: 'paused: AMS lost', 27: 'paused: heatbreak fan slow',
  28: 'paused: chamber temp error', 29: 'cooling chamber', 30: 'paused by G-code',
  31: 'motor noise showoff', 32: 'paused: nozzle clumping', 33: 'paused: cutter error',
  34: 'paused: first layer error', 35: 'paused: nozzle clog',
}

// serial-number prefixes (first 3 characters) → model, for the label
const MODELS = {
  '00M': 'X1C', '00W': 'X1', '03W': 'X1E', '01S': 'P1P', '01P': 'P1S',
  '030': 'A1 mini', '039': 'A1', '094': 'H2D', '093': 'H2S', '22E': 'P2S',
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// H2 printers pack a temperature and its target into one number:
// current in the low 16 bits, target in the high 16 bits
const unpackTemp = (v) => {
  const n = num(v)
  if(n === null) return null
  return { current: n & 0xffff, target: (n >>> 16) & 0xffff }
}

// objects merge, everything else (arrays included) is replaced
const merge = (target, src) => {
  for(const [k, v] of Object.entries(src)) {
    if(v && typeof v === 'object' && !Array.isArray(v)
       && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      merge(target[k], v)
    } else {
      target[k] = v
    }
  }
  return target
}

class BambuService extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'bambu')
    this._printers = []
    this._emitTimer = null
    this._lastEmit = 0
    this._staleLoop = null
  }

  async start() {
    let list
    try {
      list = this.config.getProp('bambu.printers')
    } catch(err) {
      list = null
    }
    list = (Array.isArray(list) ? list : [])
      .filter(p => p && p.host && p.serial && p.accessCode)
    if(!list.length) {
      this._configError = 'No printers in the bambu.printers config'
      this.logger.log(this._configError)
      return
    }
    this._printers = list.map((p, i) => ({
      index: i,
      name: p.name || `Printer ${i+1}`,
      host: p.host,
      serial: String(p.serial),
      accessCode: String(p.accessCode),
      model: p.model || MODELS[String(p.serial).slice(0, 3)] || '',
      raw: {},
      connected: false,
      lastReport: 0,
      error: null,
      client: null,
      pushallTimer: null,
    }))
    this._printers.forEach(p => this._connect(p))
    // mark printers that went quiet as offline
    this._staleLoop = setInterval(() => this._scheduleEmit(), 30*1000)
  }

  _connect(p) {
    // the access code is the MQTT password; it is never logged or sent to the browser
    const client = mqtt.connect(`mqtts://${p.host}:8883`, {
      username: 'bblp',
      password: p.accessCode,
      rejectUnauthorized: false, // the printer's certificate is self-signed
      reconnectPeriod: 30*1000,
      connectTimeout: 15*1000,
      keepalive: 60,
      clientId: `deskhud_${Math.random().toString(16).slice(2, 10)}`,
    })
    p.client = client
    const reportTopic = `device/${p.serial}/report`

    client.on('connect', () => {
      this.logger.log(`Connected to ${p.name} (${p.host})`)
      p.connected = true
      p.error = null
      client.subscribe(reportTopic, (err) => {
        if(err) {
          p.error = 'subscribe failed'
          this.logger.error(`${p.name}: subscribe failed: ${err.message}`)
          this._scheduleEmit()
          return
        }
        this._pushall(p)
      })
      clearInterval(p.pushallTimer)
      p.pushallTimer = setInterval(() => this._pushall(p), PUSHALL_INTERVAL)
      // no emit here: the pushall answer follows within a second
    })
    client.on('message', (topic, message) => {
      if(topic !== reportTopic) return
      let msg
      try {
        msg = JSON.parse(message.toString())
      } catch(err) {
        return
      }
      if(!msg || typeof msg !== 'object' || !msg.print || typeof msg.print !== 'object') return
      merge(p.raw, msg.print)
      p.lastReport = Date.now()
      this._scheduleEmit()
    })
    client.on('error', (err) => {
      // a wrong access code shows up as "Not authorized" / "Bad username or password"
      const text = String(err && err.message || err)
      p.error = /auth|password/i.test(text) ? 'wrong access code' : text
      this.logger.error(`${p.name}: ${text}`)
      this._scheduleEmit()
    })
    client.on('close', () => {
      if(p.connected) this.logger.log(`Disconnected from ${p.name}`)
      p.connected = false
      clearInterval(p.pushallTimer)
      this._scheduleEmit()
    })
  }

  _pushall(p) {
    if(!p.client || !p.connected) return
    p.client.publish(`device/${p.serial}/request`, JSON.stringify({
      pushing: { sequence_id: '0', command: 'pushall', version: 1, push_target: 1 },
    }))
  }

  // reports arrive often while printing: send at most one update every 2 s
  _scheduleEmit() {
    if(this._emitTimer) return
    const wait = Math.max(0, this._lastEmit + EMIT_THROTTLE - Date.now())
    this._emitTimer = setTimeout(() => {
      this._emitTimer = null
      this._lastEmit = Date.now()
      this.emit(this._payload())
    }, wait)
  }

  async welcomeClient(socket) {
    if(this._configError) {
      this.emit({ error: this._configError }, socket)
    } else if(this._printers.length) {
      this.emit(this._payload(), socket)
    }
  }

  _payload() {
    return { printers: this._printers.map(p => this._summary(p)) }
  }

  _temps(r) {
    const device = r.device && typeof r.device === 'object' ? r.device : {}
    const temp = (current, target) => (num(current) === null ? null : { current: num(current), target: num(target) || 0 })
    let nozzles = []
    const extruders = device.extruder && Array.isArray(device.extruder.info) ? device.extruder.info : []
    if(extruders.length) {
      // H2: one entry per nozzle (H2D has two; id 0 is the right nozzle)
      nozzles = extruders.map(e => unpackTemp(e && e.temp)).filter(Boolean)
    }
    if(!nozzles.length && num(r.nozzle_temper) !== null) {
      nozzles = [temp(r.nozzle_temper, r.nozzle_target_temper)]
    }
    let bed = temp(r.bed_temper, r.bed_target_temper)
    if(!bed && device.bed && device.bed.info) bed = unpackTemp(device.bed.info.temp)
    let chamber = null
    if(device.ctc && device.ctc.info && num(device.ctc.info.temp) !== null) {
      chamber = unpackTemp(device.ctc.info.temp)
    } else if(num(r.chamber_temper) !== null && num(r.chamber_temper) > 0) {
      chamber = { current: num(r.chamber_temper), target: 0 }
    }
    return { nozzles, bed, chamber }
  }

  _ams(r) {
    const ams = r.ams && typeof r.ams === 'object' ? r.ams : {}
    const units = Array.isArray(ams.ams) ? ams.ams : []
    const trayNow = num(ams.tray_now)
    const slots = []
    units.forEach((unit, u) => {
      if(!unit || !Array.isArray(unit.tray)) return
      const unitId = num(unit.id) !== null ? num(unit.id) : u
      unit.tray.forEach((t, i) => {
        if(!t) return
        const trayId = num(t.id) !== null ? num(t.id) : i
        // AMS HT units have ids from 128 and a single tray
        const globalId = unitId >= 128 ? unitId : unitId*4 + trayId
        const color = typeof t.tray_color === 'string' && /^[0-9a-f]{6}/i.test(t.tray_color)
          ? parseInt(t.tray_color.slice(0, 6), 16) : null
        slots.push({
          unit: unitId >= 128 ? `HT${unitId - 127}` : String.fromCharCode(65 + unitId),
          slot: trayId + 1,
          type: t.tray_type || '',
          name: t.tray_sub_brands || '',
          color,
          empty: !t.tray_type,
          remain: num(t.remain) !== null && num(t.remain) >= 0 ? num(t.remain) : null,
          active: trayNow === globalId,
        })
      })
    })
    const external = []
    const vt = Array.isArray(r.vir_slot) ? r.vir_slot : (r.vt_tray ? [r.vt_tray] : [])
    vt.forEach((t, i) => {
      if(!t || !t.tray_type) return
      external.push({
        unit: 'EXT', slot: vt.length > 1 ? i+1 : null, type: t.tray_type, name: t.tray_sub_brands || '',
        color: typeof t.tray_color === 'string' && /^[0-9a-f]{6}/i.test(t.tray_color) ? parseInt(t.tray_color.slice(0, 6), 16) : null,
        empty: false, remain: null, active: trayNow === 254 || num(t.id) === trayNow,
      })
    })
    return {
      slots: slots.concat(external),
      humidity: units.map(u => num(u && u.humidity_raw) !== null ? `${num(u.humidity_raw)}%` : null).filter(Boolean),
    }
  }

  _summary(p) {
    const r = p.raw
    const stale = !p.lastReport || Date.now() - p.lastReport > STALE_AFTER
    const online = p.connected && !stale
    const state = typeof r.gcode_state === 'string' ? r.gcode_state.toUpperCase() : null
    const stage = num(r.stg_cur)
    const remaining = num(r.mc_remaining_time) // minutes
    const start = num(r.gcode_start_time)
    const hms = Array.isArray(r.hms) ? r.hms.length : 0
    const printError = num(r.print_error) || 0
    let status = 'offline'
    if(online) {
      status = state === 'RUNNING' ? 'printing'
        : state === 'PAUSE' ? 'paused'
        : state === 'FINISH' ? 'finished'
        : state === 'FAILED' ? 'failed'
        : state === 'PREPARE' ? 'preparing'
        : state === 'SLICING' ? 'slicing'
        : 'idle'
    }
    const active = status === 'printing' || status === 'paused' || status === 'preparing'
    const file = (r.subtask_name || r.gcode_file || '').toString()
      .replace(/^.*[\\/]/, '').replace(/\.(gcode|3mf)(\.3mf)?$/i, '')
    return {
      name: p.name,
      model: p.model,
      status,
      error: online ? null : (p.error || (p.connected ? 'no data from printer' : 'not connected')),
      stage: active && stage !== null && stage > 0 && STAGES[stage] ? STAGES[stage] : null,
      file: active || status === 'finished' || status === 'failed' ? file : '',
      percent: num(r.mc_percent),
      remainingMin: active ? remaining : null,
      endTime: active && remaining !== null && status === 'printing' ? Date.now() + remaining*60*1000 : null,
      startTime: start && start > 1e9 ? start*1000 : null,
      layer: num(r.layer_num),
      totalLayers: num(r.total_layer_num),
      speed: [null, 'silent', 'standard', 'sport', 'ludicrous'][num(r.spd_lvl)] || null,
      temps: this._temps(r),
      ams: this._ams(r),
      problems: hms + (printError ? 1 : 0),
      updated: p.lastReport || null,
    }
  }
}

module.exports = BambuService
