import TextField, { TEXT_GREY } from '../../frontend/components/TextField'

// One horoscope reading on the main screen: the provider's date label on
// top, then the reading in mixed case (a plain PIXI.Text: TextField would
// capitalise it, which is hard to read at this length), sized to fit the
// panel, and the credit the API's terms ask for at the bottom.

const WIDTH = 560
const TOP = -80
const BOTTOM = 76
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// "2026-11-11" -> "Wednesday 11 November", "2026-11" -> "November 2026"
function dateLabel(date, period) {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '')
  if(m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    const text = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
    return period === 'weekly' ? `week of ${text}` : text
  }
  m = /^(\d{4})-(\d{2})$/.exec(date || '')
  if(m) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`
  return date || ''
}

export default class ReadingScreen extends PIXI.Container {
  constructor(period) {
    super()
    this._period = period
    this.progress = 0
    this._reading = undefined
    this._error = null

    this._date = new TextField('', {
      fontFamily: 'ShareTechMono', fontSize: 11, fill: TEXT_GREY, strokeThickness: 0,
    })
    this._date.anchor.set(0, 0.5)
    this._date.x = -WIDTH/2
    this._date.y = TOP - 4
    this.addChild(this._date)

    this._text = new PIXI.Text('', {
      fontFamily: 'ShareTechMono',
      fontSize: 14,
      fill: '#ffffff',
      wordWrap: true,
      wordWrapWidth: WIDTH,
      lineHeight: 19,
    })
    this._text.resolution = window.devicePixelRatio || 1
    this._text.roundPixels = true
    this._text.x = -WIDTH/2
    this._text.y = TOP + 8
    this.addChild(this._text)

    this._credit = new TextField('Powered by FreeHoroscopeAPI', {
      fontFamily: 'ShareTechMono', fontSize: 10, fill: TEXT_GREY, strokeThickness: 0,
    })
    this._credit.anchor.set(1, 0.5)
    this._credit.x = WIDTH/2
    this._credit.y = BOTTOM + 13
    this.addChild(this._credit)
  }

  // reading: {date, text} or null; error: why it is missing or stale
  show(reading, error) {
    if(reading === this._reading && error === this._error) return
    this._reading = reading
    this._error = error
    if(!reading) {
      this._date.text = ''
      this._fit(error ? `No reading yet: ${error}` : 'Loading...')
      return
    }
    this._date.text = dateLabel(reading.date, this._period) + (error ? '  (could not update)' : '')
    this._fit(reading.text)
  }

  // the largest font size (14 down to 10) at which the text fits
  _fit(text) {
    const style = this._text.style
    for(let size = 14; size >= 10; size--) {
      style.fontSize = size
      style.lineHeight = Math.round(size * 1.35)
      if(PIXI.TextMetrics.measureText(text, style).height <= BOTTOM - (TOP + 8)) break
    }
    this._text.text = text
  }

  render(renderer) {
    this._date.progress = this.progress
    this._credit.progress = this.progress
    this._text.alpha = this.progress
    super.render(renderer)
  }
}
