import { TEXT_SCALE } from '../../frontend/components/TextField.js'
import { ICONS, ICON_COLORS, WEATHER_FONT, bandFill } from './weatherIcons.js'

// A coloured weather-font icon, centred on its position. See ICON_COLORS for
// how multi-colour icons are built from one or two glyphs.
export default class WeatherIcon extends PIXI.Container {
  constructor(fontSize) {
    super()
    this._fontSize = fontSize
    this._code = null
    this.progress = 0
    const style = () => ({ fontFamily: WEATHER_FONT, fontSize, strokeThickness: 0 })
    this._base = new PIXI.Text('', style())
    this._overlay = new PIXI.Text('', style())
    for(const t of [this._base, this._overlay]) {
      // same size as the TextField icons this replaces
      t.scale.set(TEXT_SCALE)
      t.resolution = (window.devicePixelRatio || 1) * TEXT_SCALE
      this.addChild(t)
    }
  }

  get code() {
    return this._code
  }

  set code(code) {
    if(code === this._code) return
    this._code = code
    const glyph = ICONS[code] || ''
    const colors = ICON_COLORS[code] || { bands: [['#ffffff', 1]] }
    this._base.text = glyph
    Object.assign(this._base.style, bandFill(colors.bands))
    this._overlay.text = glyph && colors.overlay ? colors.overlay : ''
    if(colors.overlay) Object.assign(this._overlay.style, bandFill(colors.overlayBands))
    // both glyphs share the text origin; centre on the main glyph
    this._base.updateText(true)
    const w = this._base.width
    const h = this._base.height
    this._base.position.set(-w/2, -h/2)
    this._overlay.position.set(-w/2, -h/2)
  }

  get fontSize() {
    return this._fontSize
  }

  set fontSize(v) {
    if(v === this._fontSize) return
    this._fontSize = v
    this._base.style.fontSize = v
    this._overlay.style.fontSize = v
    const code = this._code
    this._code = null
    this.code = code // re-centre
  }

  render(renderer) {
    this.alpha = this.progress
    super.render(renderer)
  }
}
