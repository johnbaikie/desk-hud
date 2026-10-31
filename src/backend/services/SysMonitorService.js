const Service = require('./Service.js')
const os 	= require('os-utils');
const fs 	= require('fs');
const path = require('path')

class SysMonitorService extends Service {

  constructor(config, io, webApp) {
    super(config, io, webApp, 'system')
    this._loop = null
    this._cpuTempReadFails = 0
    this._fanDir = undefined
  }

  async start() {

    if(this._loop) {
      clearInterval(this._loop)
    }
    this._loop = setInterval(() => this.update(), 3000)
    this.update()
  }


  async welcomeClient(socket) {
    const result = await this.fetchAll()
    if(result) {
      this.emit(result, socket)
    }
  }

  async update() {
    const result = await this.fetchAll()
    if(result) {
      this.emit(result)
    }
  }

  async fetchAll() {
    let cpuTemp = this._getCpuTemp()
   
    return {
      cpuLoad: os.loadavg(1)/100,
      memLoad: 1-os.freememPercentage(),
      cpuTemp,
      ...this._getFan()
    }
  }

  // The Pi 5 fan header is driven by the firmware; read its speed from the
  // pwm-fan hwmon device. Both values are null when no fan is found.
  _getFan() {
    if(this._fanDir === undefined) {
      this._fanDir = null
      try {
        const base = '/sys/class/hwmon'
        for(const dir of fs.readdirSync(base)) {
          const name = fs.readFileSync(path.join(base, dir, 'name'), 'utf8').trim()
          if(name === 'pwmfan') {
            this._fanDir = path.join(base, dir)
            break
          }
        }
      } catch(err) {
        // not a Pi (or no hwmon); leave the fan readout empty
      }
      if(!this._fanDir) {
        this.logger.warn('No pwmfan device found, fan speed not shown')
      }
    }
    if(!this._fanDir) {
      return {cpuFanRpm: null, cpuFanLevel: null}
    }
    try {
      return {
        cpuFanRpm: Number(fs.readFileSync(path.join(this._fanDir, 'fan1_input'), 'utf8')),
        cpuFanLevel: Number(fs.readFileSync(path.join(this._fanDir, 'pwm1'), 'utf8'))/255,
      }
    } catch(err) {
      return {cpuFanRpm: null, cpuFanLevel: null}
    }
  }

  _getCpuTemp() {
    const maxFails = 8
    if(this._cpuTempReadFails >= maxFails) {
      return 0
    }
    try {
      const result = Number(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8'))/1000
      this._cpuTempReadFails = 0
      return result
    } catch(err) {
      this._cpuTempReadFails++
      this.logger.warn(`Unable to read CPU temperature (${this._cpuTempReadFails}/${maxFails})`, String(err))
      if(this._cpuTempReadFails >= maxFails) {
        this.logger.warn('Disabling CPU temperature check due to too many errors')
      }
      return 0
    }
  }

  emit(payload, socket=null) {
    (socket || this._io).emit('system', payload)
  }

  async onMessage(payload) {
    this.logger.log("message received", payload)
    if(payload.action === 'kill' ) {
      this.logger.log("Killing the server... should be started back again by PM2")
      process.kill(process.pid, 'SIGTERM');
      setTimeout(() => process.exit(0), 1000)
    } 
  }

}

module.exports = SysMonitorService