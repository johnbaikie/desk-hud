const CalendarService = require("./calendar/CalendarService")
const OutlookService = require("./outlook/OutlookService")
const PomodoroService = require("./pomodoro/PomodoroService")
const StocksService = require("./stocks/StocksService")
const TodoService = require("./todo/TodoService")
const WeatherService = require("./weather/WeatherService")
const NetworkService = require("./network/NetworkService")
const F1Service = require("./f1/F1Service")
const SportsService = require("./sports/SportsService")
const HoroscopeService = require("./horoscope/HoroscopeService")
const WordService = require("./word/WordService")
const BambuService = require("./bambu/BambuService")
const LaunchesService = require("./launches/LaunchesService")
// switches for optional features: "google" runs the Google Calendar and
// Tasks services; the code stays either way
const features = require("./features.json")

const services = [
  StocksService,
  WeatherService,
  ...(features.google ? [CalendarService] : []),
  OutlookService,
  ...(features.google ? [TodoService] : []),
  PomodoroService,
  NetworkService,
  F1Service,
  SportsService,
  HoroscopeService,
  WordService,
  BambuService,
  LaunchesService,
]
module.exports = services