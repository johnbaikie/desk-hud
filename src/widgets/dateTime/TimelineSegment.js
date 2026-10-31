import LineArt from "../../frontend/components/LineArt"
import TextField from "../../frontend/components/TextField"

const CHAR_WIDTH = 10 // px per character: 3 characters per 30px hour cell

export default class TimelineSegment extends PIXI.Container {
  constructor() {
    super()
    
    this.progress = 0

    const h = 34

    this._bg = new PIXI.Graphics()
    this._bg.beginFill(0x666666)
    this._bg.drawRect(30*5, -h/2, 14*30, h)
    this._bg.beginFill(0xcccccc)
    this._bg.drawRect(30*8, -h/2, 8*30, h)
    this.addChild(this._bg)

    const lightNumbers =  Array(24).fill(1).map((_, i) => (i < 8 || i > 15) ? String(i).padStart(2, '0') : '  ')
    const darkNumbers =  Array(24).fill(1).map((_, i) => (i < 8 || i > 15) ? '  ' : String(i).padStart(2, '0'))

    this._hourLabels = new TextField(lightNumbers.join(' '), {
      fontFamily: 'ShareTechMono',
      fontSize: 13.5,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'left',
    })
    this._hourLabels.x = 4
    this._hourLabels.y = 0
    this._hourLabels.anchor.set(0, 0.5)
    this.addChild(this._hourLabels)

    this._darkHourLabels = new TextField(darkNumbers.join(' '), {
      fontFamily: 'ShareTechMono',
      fontSize: 13.5,
      fill: '#000000',
      stroke: "#000000",
      strokeThickness: 0.5,
      align: 'left',
    })
    this._darkHourLabels.x = 4
    this._darkHourLabels.y = 0
    this._darkHourLabels.anchor.set(0, 0.5)
    this.addChild(this._darkHourLabels)

    // each hour cell is 30px wide and holds "NN " (3 characters), so space
    // the letters to exactly 10px whatever the font's own width is
    for(const labels of [this._hourLabels, this._darkHourLabels]) {
      labels.scale.set(1)
      const charWidth = PIXI.TextMetrics.measureText('00', labels.style).width/2
      labels.style.letterSpacing = CHAR_WIDTH - charWidth
    }

  }

  render(renderer) {
    this._hourLabels.progress = this.progress
    this._darkHourLabels.progress = this.progress
    this._bg.alpha = this.progress
    
    super.render(renderer)
  }
}