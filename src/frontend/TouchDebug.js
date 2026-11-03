// Temporary touch diagnostics: marks every pointer press on screen and
// reports where it landed, its type and which widget is under it, so taps
// can be checked against what the HUD does with them.
export default class TouchDebug {
  constructor(app, report) {
    this._app = app
    this._report = report
    this._marks = new PIXI.Container()
    app.stage.addChild(this._marks)

    // capture phase on the canvas: sees every press, even ones a Pixi object
    // stops from propagating
    app.view.addEventListener('pointerdown', (e) => this._onDown(e), {capture: true})
    app.ticker.add(() => this._fade())
  }

  _onDown(e) {
    const rect = this._app.view.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) * this._app.screen.width / rect.width)
    const y = Math.round((e.clientY - rect.top) * this._app.screen.height / rect.height)

    const mark = new PIXI.Graphics()
    mark.lineStyle(2, 0x00ff41)
    mark.moveTo(-15, 0).lineTo(15, 0).moveTo(0, -15).lineTo(0, 15)
    mark.drawCircle(0, 0, 6)
    mark.x = x
    mark.y = y
    mark.bornAt = performance.now()
    this._marks.addChild(mark)
    // keep the marks above anything added to the stage later
    this._app.stage.addChild(this._marks)

    this._report({x, y, type: e.pointerType, target: this._describe(x, y)})
  }

  _describe(x, y) {
    let obj = this._app.renderer.events.rootBoundary.hitTest(x, y)
    if(!obj) return 'nothing'
    const hit = obj
    while(obj) {
      if(typeof obj.id === 'string' && obj.id) {
        return `widget:${obj.id}` + (hit === obj ? '' : ' (child)')
      }
      obj = obj.parent
    }
    return 'other'
  }

  _fade() {
    const now = performance.now()
    for(const mark of [...this._marks.children]) {
      mark.alpha = Math.max(0, 1 - (now - mark.bornAt)/3000)
      if(mark.alpha <= 0) {
        this._marks.removeChild(mark)
        mark.destroy()
      }
    }
  }
}
