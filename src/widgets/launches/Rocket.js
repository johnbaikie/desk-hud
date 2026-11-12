// A small side-view rocket drawn with Graphics: body and fins in the widget's
// accent, a white window and nose band, and a white flame that flickers
// while `flame` is set. The nose points along +x; the origin is the middle of
// the body, ROCKET_LENGTH long from the end of the flame to the nose.
export const ROCKET_LENGTH = 30

export default class Rocket extends PIXI.Container {
  constructor(color) {
    super()
    const body = new PIXI.Graphics()
    // fins at the tail
    body.beginFill(color)
    body.drawPolygon([-9, -3, -13, -7.5, -6, -3])
    body.drawPolygon([-9, 3, -13, 7.5, -6, 3])
    body.endFill()
    // body and nose cone
    body.beginFill(color)
    body.drawPolygon([
      -10, -3,
      6, -3,
      9, -2,
      12, 0,
      9, 2,
      6, 3,
      -10, 3,
    ])
    body.endFill()
    // window and the band under the nose
    body.beginFill(0x000000)
    body.drawCircle(1.5, 0, 1.6)
    body.endFill()
    body.beginFill(0xffffff)
    body.drawCircle(1.5, 0, 1)
    body.drawRect(5, -3, 1.2, 6)
    body.endFill()
    this.addChild(body)

    this._flame = new PIXI.Graphics()
    this._flame.beginFill(0xffffff)
    this._flame.drawPolygon([-10, -2, -18, 0, -10, 2])
    this._flame.endFill()
    this.addChild(this._flame)
    this.flame = false
  }

  render(renderer) {
    this._flame.visible = this.flame
    if(this.flame) {
      const t = performance.now()
      this._flame.scale.x = 0.8 + 0.25*Math.sin(t*0.031) + 0.1*Math.sin(t*0.087)
      this._flame.alpha = 0.75 + 0.25*Math.sin(t*0.05)
    }
    super.render(renderer)
  }
}
