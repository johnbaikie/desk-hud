const Service = require('./Service.js')
const exec = require('child_process').exec

const HDMI_ON_COMMAND = `sudo chvt 7; sudo sh -c 'echo "0" > /sys/class/graphics/fb0/blank'`
const HDMI_OFF_COMMAND = `sudo chvt 1; sudo sh -c 'echo "1" > /sys/class/graphics/fb0/blank'`

// No distance sensor is fitted, so readings are simulated in-process: someone
// always sitting at the desk. (This used to be a separate node process,
// distance_mock.js, which cost ~45 MB of memory for the same constant value.)
const MOCK_DISTANCE = 20 // cm
const MOCK_INTERVAL = 50 // ms between readings

class DistanceService extends Service {

  constructor(config, io, webApp) {
    super(config, io, webApp, 'distance')
    this._loop = null
    this._sensor = null
    this._queue = []
    this._distance = 0
    this._lastSensorDataTime = 10000
    this._isAwake = false
    this._isPowerOn = false
    this._inactivityTimer = 0
  }

  async start() {
    this._startSensor()

    if(this._loop) {
      clearInterval(this._loop)
    }
    this._loop = setInterval(() => this.update(), 300)
    this.update()
  }

  _startSensor() {
    if(this._sensor) {
      clearInterval(this._sensor)
    }
    this.logger.log('starting distance monitor (mock)')
    this._sensor = setInterval(() => {
      this._queue.push(MOCK_DISTANCE)
      this._lastSensorDataTime = performance.now()
    }, MOCK_INTERVAL)
  }

  async welcomeClient(socket) {
    const result = await this.fetchAll() || {}
    this.emit({...result, distance: this._distance, sensorDataAge: Math.max(0, performance.now() - this._lastSensorDataTime)}, socket)
  }

  async update() {
    const result = await this.fetchAll()
    if(result) {
      this.emit(result)
    }
  }

  async fetchAll() {
    const dataAge = Math.max(0, performance.now() - this._lastSensorDataTime)
    if(dataAge > 3000) {
      this.logger.log("Sensor data is outdated. skipping")
      this._queue = []
      this._lastSensorDataTime = performance.now()
      this._startSensor()
      return null;
    }
    if(this._queue.length === 0) {
      return null
    }
    let sum = 0
    let count = 0
    let max = this._queue[0]
    let min = this._queue[0]
    let val
    while(this._queue.length > 0) {
      count++
      val = this._queue.shift()
      sum += val
      min = Math.min(min, val)
      max = Math.max(max, val)
    }
    for(let i=0; i <this._queue.length; i++) {
      count++
      val = this._queue[i]
      sum += val
      min = Math.min(min, val)
      max = Math.max(max, val)
    }
    if(count <= 0) return null

    const distance = Math.round(sum/count)
    const wakeUpThreshold = this.config.getProp('core.distance.wakeUp')
    const goSleepThreshold = this.config.getProp('core.distance.goSleep')
    if(distance < goSleepThreshold) {
      this._inactivityTimer = 0
    } else {
      this._inactivityTimer+=500
    }
    if(this._isPowerOn  && this._inactivityTimer > this.config.getProp('core.powerOffTime')) {
      // power off
      this._isPowerOn = false
      this.logger.log("Power HDMI off")
      exec(HDMI_OFF_COMMAND, (err) => this.logger.warn('Unable to turn HDMI off', String(err)))
    } else if(!this._isPowerOn && this._inactivityTimer === 0) {
      // power on
      this._isPowerOn = true
      this.logger.log("Power HDMI on")
      exec(HDMI_ON_COMMAND, (err) => this.logger.warn('Unable to turn HDMI on', String(err)))
    }
    if(distance < wakeUpThreshold && !this._isAwake) {
      // wake up
      this.logger.log("wake up")
      this._isAwake = true
      return {distance, action: 'wakeUp', dataAge}
    } else if(this._inactivityTimer > 10000 && this._isAwake) {
      // go sleep
      this.logger.log("go sleep")
      this._isAwake = false
      this._distance = distance
      return {distance, action: 'goSleep', dataAge}
    } else {
      return {distance, dataAge}
    }
    
  }

  emit(payload, socket=null) {
    (socket || this._io).emit('distance', payload)
  }

}

module.exports = DistanceService