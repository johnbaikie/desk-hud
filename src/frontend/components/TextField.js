// Enlarges every TextField without touching font sizes in widget code.
// Resolution is raised by the same factor so the text stays sharp.
export const TEXT_SCALE = 1.1

export default class TextField extends PIXI.Text {

  constructor (txt, style) {
    super('', style)
    this.scale.set(TEXT_SCALE)
    this.resolution = (window.devicePixelRatio || 1) * TEXT_SCALE
    this._progress = 0
    this._origText = String(txt).toUpperCase()
    this.anchor.set(0.5)
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