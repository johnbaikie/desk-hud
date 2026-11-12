
import DateTimeWidget from './dateTime'
import WeatherWidget from './weather'
import CalendarWidget from './calendar'
import TodoWidget from './todo'
import PomodoroWidget from './pomodoro'
import StocksWidget from './stocks'
import NetworkWidget from './network'
import F1Widget from './f1'
import SportsWidget from './sports'
import HoroscopeWidget from './horoscope'
import WordWidget from './word'
import BambuWidget from './bambu'
import LaunchesWidget from './launches'
import AccentWidget from './accent'
// switches for optional features: "google" adds the Tasks widget (and the
// Calendar's Personal tab, see CalendarWidget); the code stays either way
import features from './features.json'

const widgets = [
  DateTimeWidget,
  WeatherWidget,
  CalendarWidget,
  ...(features.google ? [TodoWidget] : []),
  PomodoroWidget,

  StocksWidget,
  NetworkWidget,
  F1Widget,
  SportsWidget,
  HoroscopeWidget,
  WordWidget,
  BambuWidget,
  LaunchesWidget,
  AccentWidget,
  
]
export default widgets