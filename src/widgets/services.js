const CalendarService = require("./calendar/CalendarService")
const OutlookService = require("./outlook/OutlookService")
const PomodoroService = require("./pomodoro/PomodoroService")
const StocksService = require("./stocks/StocksService")
const TodoService = require("./todo/TodoService")
const WeatherService = require("./weather/WeatherService")
const NetworkService = require("./network/NetworkService")
const F1Service = require("./f1/F1Service")

const services = [
  StocksService,
  WeatherService,
  CalendarService,
  OutlookService,
  TodoService,
  PomodoroService,
  NetworkService,
  F1Service,
]
module.exports = services