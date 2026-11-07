// A small side-view Formula 1 car drawn with Graphics: the body in the
// widget's accent, white wheels and helmet. Nose points along +x, wheels at
// the bottom; the origin is the middle of the car with the wheels' lowest
// point at y = WHEEL_BOTTOM, so it can sit on a line.
export const CAR_LENGTH = 30
export const WHEEL_BOTTOM = 5.5

export default class F1Car extends PIXI.Graphics {
  constructor(color) {
    super()
    // body: rear wing, engine cover, airbox, cockpit, long nose
    this.beginFill(color)
    this.drawPolygon([
      -15, 1.5,
      -15, -6,    // rear wing
      -11, -6,
      -11, -2,
      -6, -2,
      -4, -5.5,   // airbox
      0, -5.5,
      1, -3,      // cockpit
      5, -2.5,
      14, -0.5,   // nose
      15, 1,
      15, 1.5,
    ])
    this.endFill()
    // front wing under the nose
    this.beginFill(color)
    this.drawRect(11, 1.5, 4.5, 1.5)
    this.endFill()
    // driver's helmet
    this.beginFill(0xffffff)
    this.drawCircle(2.4, -3.6, 1.6)
    this.endFill()
    // wheels with a dark hub
    for(const x of [-9.5, 8]) {
      this.beginFill(0xffffff)
      this.drawCircle(x, 2, 3.5)
      this.endFill()
      this.beginFill(0x000000)
      this.drawCircle(x, 2, 1.2)
      this.endFill()
    }
  }
}
