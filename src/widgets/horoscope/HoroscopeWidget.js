import Widget from '../../frontend/Widget.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField.js'
import { ACCENT } from '../../frontend/theme.js'
import ReadingScreen from './ReadingScreen.js'
import DailyScreen from './DailyScreen.js'

// Horoscopes from HoroscopeService for the sign in `horoscope.sign`.
// Circle: the sign's symbol in the accent colour, its name and dates.
// Main screen: TODAY (DailyScreen: FreeAstroAPI's forecast, scores and lucky
// things), WEEK and MONTH (ReadingScreen) tabs.

// symbol (U+2648..U+2653, with U+FE0E to ask for the plain text form, not an
// emoji) and dates of each sign
const SIGNS = {
  aries: ['♈', 'mar 21 - apr 19'],
  taurus: ['♉', 'apr 20 - may 20'],
  gemini: ['♊', 'may 21 - jun 20'],
  cancer: ['♋', 'jun 21 - jul 22'],
  leo: ['♌', 'jul 23 - aug 22'],
  virgo: ['♍', 'aug 23 - sep 22'],
  libra: ['♎', 'sep 23 - oct 22'],
  scorpio: ['♏', 'oct 23 - nov 21'],
  sagittarius: ['♐', 'nov 22 - dec 21'],
  capricorn: ['♑', 'dec 22 - jan 19'],
  aquarius: ['♒', 'jan 20 - feb 18'],
  pisces: ['♓', 'feb 19 - mar 20'],
}
const TABS = [['today', 'daily'], ['week', 'weekly'], ['month', 'monthly']]

export default class HoroscopeWidget extends Widget {
  constructor() {
    super('horoscope', 'Horoscope')
    this.initState({ sign: null, readings: {}, errors: {} })

    // the zodiac symbols aren't in ShareTechMono: DejaVu Sans has them on
    // the Pi, the others are fallbacks for development machines
    this._symbol = new PIXI.Text('', {
      fontFamily: ['DejaVu Sans', 'Apple Symbols', 'Segoe UI Symbol', 'sans-serif'],
      fontSize: 40,
      fill: '#' + ACCENT.toString(16).padStart(6, '0'),
    })
    this._symbol.anchor.set(0.5)
    this._symbol.resolution = 2
    this.addChild(this._symbol)

    this._name = new TextField('', {
      fontFamily: 'ShareTechMono', fontSize: 16, fill: '#ffffff', stroke: '#ffffff', strokeThickness: 0.5, align: 'center',
    })
    this.addChild(this._name)
    this._dates = new TextField('', {
      fontFamily: 'ShareTechMono', fontSize: 10, fill: TEXT_GREY, strokeThickness: 0, align: 'center',
    })
    this.addChild(this._dates)

    this.main.title = 'Horoscope'
    this._screens = TABS.map(([name, period], i) => {
      const tab = this.main.getTabButton(i)
      tab.text = name
      tab.visible = true
      const screen = period === 'daily' ? new DailyScreen() : new ReadingScreen(period)
      this.main.getPage(i).addChild(screen)
      return screen
    })
  }

  msg2state(msg) {
    if(msg.error) return { error: msg.error }
    if(!msg.sign || !SIGNS[msg.sign] || !msg.readings || typeof msg.readings !== 'object') {
      return { error: 'No horoscope data' }
    }
    const readings = {}
    for(const [, period] of TABS) {
      const r = msg.readings[period]
      if(r && typeof r.text === 'string' && r.text) readings[period] = r
    }
    return {
      sign: msg.sign,
      readings,
      errors: msg.errors && typeof msg.errors === 'object' ? msg.errors : {},
      error: null,
    }
  }

  updateState(obj) {
    super.updateState(obj)
    const s = this.state
    if(!s.sign) return
    const [symbol, dates] = SIGNS[s.sign]
    this._symbol.text = symbol + '︎'
    this._name.text = s.sign
    this._dates.text = dates
    this._screens.forEach((screen, i) => {
      const period = TABS[i][1]
      screen.show(s.readings[period] || null, s.errors[period] || null)
    })
    this.main.statusLeftText = s.sign
  }

  render(renderer) {
    const p = this.progress * this.dataLoadProgress
    this._symbol.alpha = p
    this._symbol.style.fontSize = 22 + 22*this.size
    this._symbol.y = -18*this.size
    this._name.progress = p
    this._name.style.fontSize = 9 + 7*this.size
    this._name.y = 24*this.size
    this._dates.progress = p
    this._dates.y = 42*this.size
    this._dates.visible = this.size === 1
    this._screens.forEach(screen => screen.progress = this.main.progress * this.dataLoadProgress)
    super.render(renderer)
  }
}
