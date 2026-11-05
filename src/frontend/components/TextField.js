// Enlarges every TextField without touching font sizes in widget code.
// Resolution is raised by the same factor so the text stays sharp.
export const TEXT_SCALE = 1.1

// Secondary text: use these solid greys with strokeThickness 0 rather than
// fading white text with alpha; faded text with a 0.5 px outline looks
// blurry on the Pi's 1x screen.
export const TEXT_GREY = '#b8b8b8'
export const TEXT_DIM = '#8f8f8f'

export default class TextField extends PIXI.Text {

  constructor (txt, style) {
    super('', style)
    this.scale.set(TEXT_SCALE)
    this.resolution = (window.devicePixelRatio || 1) * TEXT_SCALE
    this._progress = 0
    this._origText = String(txt).toUpperCase()
    this.anchor.set(0.5)
    // snap to whole screen pixels: centred text otherwise lands on half pixels and blurs
    this.roundPixels = true
    this._changed = true
  }

  set progress(v) {
    this._changed = (this._changed || this._progress !== v)
    this._progress = v
  }

  get progress() {
    return this._progress
  }

  set text(v) {
    const newText = String(v).toUpperCase()
    this._changed = (this._changed || this._origText !== newText)
    this._origText = newText
  }

  get text() {
    return this._origText
  }

  render(renderer) {
    super.render(renderer)
    if(!this._changed) {
      return
    }

    super.text = this._origText.substr(0, Math.round(this._progress*this._origText.length))
    this._changed = false
  }
}