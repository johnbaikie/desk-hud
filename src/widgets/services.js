const CalendarService = require("./calendar/CalendarService")
const PomodoroService = require("./pomodoro/PomodoroService")
const StocksService = require("./stocks/StocksService")
const TodoService = require("./todo/TodoService")
const WeatherService = require("./weather/WeatherService")

const services = [
  StocksService,
  WeatherService,
  CalendarService,
  TodoService,
  PomodoroService,
]
module.exports = services