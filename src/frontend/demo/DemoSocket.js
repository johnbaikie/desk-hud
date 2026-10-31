import CalendarDemoData from "./CalendarDemoData"
import PomodoroDemoData from "./PomodoroDemoData"
import TodoDemoData from "./TodoDemoData"
import WeatherDemoData from "./WeatherDemoData"
import DateTimeDemoData from "./DateTimeDemoData"
import StocksDemoData from "./StocksDemoData"

export default class DemoSocket {
  constructor() {
    this._weatherDemo = new WeatherDemoData()
    this._todoDemo = new TodoDemoData()
    this._pomodoroDemo = new PomodoroDemoData()
    this._calendarDemo = new CalendarDemoData()
    this._dateTimeDemo = new DateTimeDemoData()
    this._stocksDemo = new StocksDemoData()

    
    this._listeners = {}

    setTimeout(() => {
      this._publish('connect');
      this._publish('config', this._getConfig())
      this._publish('widget', this._weatherDemo.data)
      this._publish('widget', this._todoDemo.data)
      this._publish('widget', this._calendarDemo.data)
      this._publish('widget', this._pomodoroDemo.data)
      this._publish('widget', this._stocksDemo.data)
    }, 500)

    setTimeout(() => {
      this._publish('distance', {
        "distance": 45 + 5*Math.random(),
        "sensorDataAge": 33,
        "action": "wakeUp"
      })
    }, 1000)

    setTimeout(() => {
      this._publish('system', this._getSystemData())
    }, 500)

    setInterval(() => {
      this._publish('system', this._getSystemData())
    }, 3000)

    setInterval(() => {
      this._publish('distance', {
        "distance": 45 + 5*Math.random(),
        "sensorDataAge": 33,
      })
    }, 1000)
  }  

  _getSystemData() {
    return {
      cpuLoad: 0.21 + 0.05 * Math.random(),
      memLoad: 0.63 + 0.03 * Math.random(),
      cpuTemp: 55 + 10 * Math.random(),
      cpuFanRpm: 2300 + Math.round(100 * Math.random()),
      cpuFanLevel: 0.3
    }
  }

  _publish(eventName, ...args) {
    if(!this._listeners[eventName]) {
      this._listeners[eventName] = []
    }
    this._listeners[eventName].forEach(c => c(...args))
  }

  _getConfig() {
    return {
      widgets: {
        dateTime: this._dateTimeDemo.config
      }
    }
  }

  on(eventName, callback) {
    if(!this._listeners[eventName]) {
      this._listeners[eventName] = []
    }
    this._listeners[eventName].push(callback)
  }

  emit(event, {serviceId, payload}) {
    if(serviceId === 'todo') {
      this._todoDemo.onMessage(payload)
      this._publish('widget', this._todoDemo.data)
    } else if(serviceId === 'pomodoro') {
      this._pomodoroDemo.onMessage(payload)
      this._publish('widget', this._pomodoroDemo.data)
    }
  }
}