import { ACCENT } from '../theme.js'
import LineArt from "./LineArt"
import TextField from "./TextField"

const W = 116
const H = 34

export default class DiamondButton extends PIXI.Container {
  constructor(text='') {
    super()

    this.progress = 0
    this._active = false

    // pill-shaped tab button (the name is historical: it used to be a
    // pointed hexagon)
    this._blackFill = new PIXI.Graphics()
    this.addChild(this._blackFill)
    this._blackFill.beginFill(0x000000)
    this._blackFill.drawRoundedRect(-W/2, -H/2, W, H, H/2)

    this._refFill = new PIXI.Graphics()
    this.addChild(this._refFill)
    this._refFill.beginFill(ACCENT)
    this._refFill.drawRoundedRect(-W/2, -H/2, W, H, H/2)
    this._refFill.alpha = 0

    this._frame = new LineArt()
    this.addChild(this._frame)
    this._frame.addRoundedSequence([
      0, -H/2,
      W/2, -H/2,
      W/2, H/2,
      -W/2, H/2,
      -W/2, -H/2,
      0, -H/2,
    ], H/2, 1.5, 0xffffff, 0.85)

    this._label = new TextField(text, {
      fontFamily: 'ShareTechMono',
      fontSize: 11,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'center',
    })
    this.addChild(this._label)

    this.interactive = true
    this.on('pointertap', () => {
      if(!this._active) {
        this.emit('activate')
      }
    })
  }

  set active(v) {
    this._active = v
  }

  get active() {
    return this._active
  }

  set text(v) {
    this._label.text = v
  }

  get text() {
    return this._label.text
  }

  render(renderer) {
    this._frame.progress = this.progress
    this._blackFill.alpha = this.progress
    this._refFill.alpha += ((this._active ? this.progress : 0) - this._refFill.alpha) / 7
    this._label.progress = this.progress
    this._label.style.stroke = this._active ? 0x000000 : 0xffffff
    this._label.style.fill = this._active ? 0x000000 : 0xffffff
    super.render(renderer)
  }

}