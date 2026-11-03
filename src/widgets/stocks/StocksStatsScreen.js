import TextField from '../../frontend/components/TextField'
import Icon from '../../frontend/components/Icon'

const SWIPE_DISTANCE = 30 // px of vertical drag that counts as a swipe

const textStyle = (fontSize, extra={}) => ({
  fontFamily: 'ShareTechMono',
  fontSize,
  fill: '#ffffff',
  stroke: '#ffffff',
  strokeThickness: 0.5,
  align: 'left',
  ...extra,
})

const formatPrice = (v) => Number.isFinite(v) ? v.toFixed(2) : '--'

const formatVolume = (v) => {
  if(!Number.isFinite(v)) return '--'
  if(v >= 1e9) return (v/1e9).toFixed(2) + 'B'
  if(v >= 1e6) return (v/1e6).toFixed(2) + 'M'
  if(v >= 1e3) return (v/1e3).toFixed(1) + 'K'
  return String(v)
}

// Current figures for one stock. Swiping up or down emits 'swipe' with +1/-1.
export default class StocksStatsScreen extends PIXI.Container {
  constructor() {
    super()
    this.progress = 0
    this.stock = null
    this.stockIndex = 0
    this.count = 0

    this._labels = []
    const add = (text, x, y, fontSize, anchorX=0, extra={}) => {
      const label = new TextField(text, textStyle(fontSize, extra))
      label.anchor.set(anchorX, 0.5)
      label.x = x
      label.y = y
      this.addChild(label)
      this._labels.push(label)
      return label
    }

    this._name = add('', -260, -80, 13)
    this._counter = add('', 265, -80, 12, 1)
    this._price = add('', -260, -42, 32, 0, {strokeThickness: 1})
    this._change = add('', -50, -38, 16)

    this._trendIcon = new Icon()
    this._trendIcon.scale.set(0.55)
    this._trendIcon.x = -72
    this._trendIcon.y = -40
    this.addChild(this._trendIcon)

    const rows = [
      ['open', 'prev close'],
      ['high', 'volume'],
      ['low', '6-mo range'],
    ]
    this._values = {}
    rows.forEach(([left, right], i) => {
      const y = 8 + i*28
      add(left, -260, y, 12)
      this._values[left] = add('', -140, y, 14)
      add(right, 20, y, 12)
      this._values[right] = add('', 150, y, 14)
    })

    this._hint = add('', 0, 92, 11, 0.5)

    // swipe area over the screen; the drag is tracked globally so a swipe
    // that ends outside the area (or is interrupted) never leaves it stuck
    this._swipeArea = new PIXI.Graphics()
    this._swipeArea.beginFill(0x000000, 0.0001)
    this._swipeArea.drawRect(-290, -100, 580, 205)
    this._swipeArea.interactive = true
    this.addChild(this._swipeArea)
    this._dragStartY = null
    this._swipeArea.on('pointerdown', (e) => { this._dragStartY = e.global.y })
    this._swipeArea.on('pointerup', (e) => this._endDrag(e.global.y))
    this._swipeArea.on('pointerupoutside', (e) => this._endDrag(e.global.y))
    this._swipeArea.on('pointercancel', () => { this._dragStartY = null })
    this.on('removed', () => { this._dragStartY = null })
  }

  _endDrag(y) {
    if(this._dragStartY === null) return
    const dy = y - this._dragStartY
    this._dragStartY = null
    if(Math.abs(dy) >= SWIPE_DISTANCE && this.count > 1) {
      // swipe up shows the next stock, down the previous one
      this.emit('swipe', dy < 0 ? 1 : -1)
    }
  }

  render(renderer) {
    const s = this.stock
    this._labels.forEach(l => l.progress = this.progress)
    this._swipeArea.visible = this.progress > 0.5
    this._trendIcon.alpha = this.progress

    if(s) {
      this._name.text = s.name || s.symbol
      this._counter.text = this.count > 1 ? `${this.stockIndex + 1} / ${this.count}` : ''
      this._price.text = '$' + formatPrice(s.current)

      const diff = Number.isFinite(s.dayOpen) ? s.current - s.dayOpen : 0
      const pct = s.dayOpen ? 100*diff/s.dayOpen : 0
      const sign = diff > 0 ? '+' : ''
      this._change.text = `${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%) since open`
      if(diff > 0) {
        this._trendIcon.code = 0xe5d8
        this._trendIcon.color = 0xffffff
      } else if(diff < 0) {
        this._trendIcon.code = 0xe5db
        this._trendIcon.color = 0x00ff41
      } else {
        this._trendIcon.code = 0xe15b
        this._trendIcon.color = 0xffffff
      }

      this._values['open'].text = formatPrice(s.dayOpen)
      this._values['high'].text = formatPrice(s.dayHigh)
      this._values['low'].text = formatPrice(s.dayLow)
      this._values['prev close'].text = formatPrice(s.prevClose)
      this._values['volume'].text = formatVolume(s.volume)
      this._values['6-mo range'].text = s.history && s.history.length
        ? `${Math.min(...s.history).toFixed(0)}-${Math.max(...s.history).toFixed(0)}`
        : '--'
      this._hint.text = this.count > 1 ? 'swipe up/down for next stock' : ''
    }
    super.render(renderer)
  }
}
