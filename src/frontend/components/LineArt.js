export default class LineArt extends PIXI.Container {

  constructor() {
    super()
    this.size = 1
    this.progress = 0
    this._canvas = new PIXI.Graphics()
    this.addChild(this._canvas)
    this._linesChanged = false
    this._lastHash = ''

    this._lineGroups = []
    this._lines = {}
  }

  clear() {
    this._lineGroups = []
    this._lines = {}
    this._lastHash = ''
    this._canvas.clear()
    this._linesChanged = true
  }

  addLine(x1, y1, x2, y2, width=1, color=0xffffff, alpha=1, startTime=0, endTime=1) {
    this._linesChanged = true
    const groupId = `${width.toFixed(1)}|${color.toString(16)}|${alpha.toFixed(2)}`
    this._lineGroups.push(groupId)
    if(!this._lines[groupId]) {
      this._lines[groupId] = {
        width, 
        color, 
        alpha, 
        children: []
      }
    }
    this._lines[groupId].children.push({x1, x2, y1, y2, startTime, endTime})
  }

  addSequence(coordinates, width=1, color=0xffffff, alpha=1, startTime=0, endTime=1) {
    let totalLength = 0

    for(let i=2; i < coordinates.length; i+=2) {
      const dx = coordinates[i] - coordinates[i-2]
      const dy = coordinates[i+1] - coordinates[i-1]
      totalLength += Math.sqrt(dx*dx + dy*dy)
    }
    let time = 0
    for(let i=2; i < coordinates.length; i+=2) {
      const dx = coordinates[i] - coordinates[i-2]
      const dy = coordinates[i+1] - coordinates[i-1]
      const nextTime = time + Math.sqrt(dx*dx + dy*dy) / totalLength
      this.addLine(
        coordinates[i-2],
        coordinates[i-1],
        coordinates[i],
        coordinates[i+1],
        width, 
        color, 
        alpha,
        startTime + time * (endTime - startTime),
        startTime + nextTime * (endTime - startTime)
      )
      time = nextTime
    }
  }

  // like addSequence, but every inner corner is rounded with `radius`
  // (clamped to half of the shorter neighbouring segment)
  addRoundedSequence(coordinates, radius, width=1, color=0xffffff, alpha=1, startTime=0, endTime=1) {
    this.addSequence(roundCorners(coordinates, radius), width, color, alpha, startTime, endTime)
  }

  render(renderer) {
    const hash = `${this.size.toFixed(3)}|${this.progress.toFixed(3)}`
    if(hash === this._lastHash && !this._linesChanged) {
      this._canvas.cacheAsBitmap = true
      super.render(renderer)
      return
    }
    this._canvas.cacheAsBitmap = false
    super.render(renderer)
    this._lastHash = hash
    this._linesChanged = false

    this._canvas.clear()

    for(let groupId of this._lineGroups) {
      const group = this._lines[groupId]
      this._canvas.lineStyle({
        width: group.width,
        alpha: group.alpha,
        color: group.color
      })
      for(let line of group.children) {
        this._canvas.moveTo(
          line.x1*this.size, 
          line.y1*this.size
        )
        let lineProgress = Math.min(1, Math.max(0, this.progress - line.startTime)/(line.endTime - line.startTime))
        this._canvas.lineTo(
          (line.x1 + (line.x2 - line.x1)*lineProgress)*this.size,
          (line.y1 + (line.y2 - line.y1)*lineProgress)*this.size,
        )
      }
    }
  }

}

// Replaces each inner corner of a polyline [x0, y0, x1, y1, ...] with a
// circular arc made of short segments, so LineArt can still draw it in.
export function roundCorners(coordinates, radius, segments=6) {
  const pts = []
  for(let i = 0; i < coordinates.length; i += 2) pts.push([coordinates[i], coordinates[i+1]])
  if(pts.length < 3 || radius <= 0) return coordinates.slice()
  const out = [...pts[0]]
  for(let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i-1], [cx, cy] = pts[i], [nx, ny] = pts[i+1]
    const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy)
    if(l1 === 0 || l2 === 0) continue
    const d1 = [(px - cx)/l1, (py - cy)/l1], d2 = [(nx - cx)/l2, (ny - cy)/l2]
    const angle = Math.acos(Math.max(-1, Math.min(1, d1[0]*d2[0] + d1[1]*d2[1])))
    if(angle > Math.PI - 0.01) { out.push(cx, cy); continue } // straight through
    // distance from the corner to where the arc meets each segment
    let t = radius / Math.tan(angle/2)
    t = Math.min(t, l1/2, l2/2)
    const a = [cx + d1[0]*t, cy + d1[1]*t], b = [cx + d2[0]*t, cy + d2[1]*t]
    // quadratic curve through the corner approximates the arc
    for(let k = 0; k <= segments; k++) {
      const u = k / segments
      out.push(
        (1-u)*(1-u)*a[0] + 2*(1-u)*u*cx + u*u*b[0],
        (1-u)*(1-u)*a[1] + 2*(1-u)*u*cy + u*u*b[1],
      )
    }
  }
  out.push(...pts[pts.length - 1])
  return out
}
