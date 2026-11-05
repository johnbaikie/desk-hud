// A rounded bar: a faint track and a solid fill for `value` (0..1).
// segmentCount keeps the old signature: the bar is 10 px per segment wide.
export default class ProgressBar extends PIXI.Container {
  constructor(segmentCount=10, height=10) {
    super()

    this.value = 0
    this.progress = 0
    this._width = 10 * segmentCount
    this._height = height
    this._hash = ''

    this._canvas = new PIXI.Graphics()
    this.addChild(this._canvas)
  }

  render(renderer) {
    const v = Math.max(0, Math.min(1, this.value*this.progress))
    const hash = `${v.toFixed(3)}|${this.progress.toFixed(3)}`
    if(hash !== this._hash) {
      this._hash = hash
      const w = this._width, h = this._height, r = h/2
      const g = this._canvas
      g.clear()
      g.beginFill(0xffffff, 0.15*this.progress)
      g.drawRoundedRect(0, 0, w, h, r)
      if(v > 0) {
        g.beginFill(0xffffff, 0.9)
        g.drawRoundedRect(0, 0, Math.max(h, w*v), h, r)
      }
      g.endFill()
    }
    super.render(renderer)
  }
}
