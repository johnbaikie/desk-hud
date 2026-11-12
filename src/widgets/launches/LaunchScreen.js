import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'
import { when, countdown, site, cut, exact, GOOD } from './format.js'

// The NEXT tab: one launch in detail. Left: provider, mission, a live
// countdown, rocket, time and window, pad, orbit, status and launch weather.
// Right: the mission description (mixed case, sized 13 down to 10 to fit)
// and the credit. Swiping left or right emits 'swipe' (+1 = the next launch).
// The page spans about x -295..295, y -105..98.

const LEFT = -282
const RIGHT = 20
const RIGHT_WIDTH = 262
const TOP = -90
const BOTTOM = 78
const SWIPE_DISTANCE = 30

const hex = (c) => '#' + c.toString(16).padStart(6, '0')
const field = (fontSize, fill='#ffffff', anchorX=0) => {
  const f = new TextField('', {
    fontFamily: 'ShareTechMono', fontSize, fill,
    stroke: fill, strokeThickness: fill === '#ffffff' ? 0.5 : 0,
  })
  f.anchor.set(anchorX, 0.5)
  return f
}
const minutes = (ms) => ms >= 3600000 ? `${Math.floor(ms/3600000)} H ${Math.round(ms/60000) % 60} MIN` : `${Math.round(ms/60000)} MIN`

export default class LaunchScreen extends PIXI.Container {
  constructor() {
    super()
    // kept per instance: in rainbow mode ACCENT changes from widget to widget
    this._accent = ACCENT
    this.progress = 0
    this._launch = undefined
    this._fields = []

    const swipe = new PIXI.Graphics()
    swipe.beginFill(0x000000, 0.0001)
    swipe.drawRect(-290, -100, 580, 200)
    swipe.interactive = true
    swipe.on('pointerdown', (e) => { this._dragStartX = e.global.x })
    swipe.on('pointerup', (e) => this._endDrag(e.global.x))
    swipe.on('pointerupoutside', (e) => this._endDrag(e.global.x))
    swipe.on('pointercancel', () => { this._dragStartX = null })
    this.addChild(swipe)
    this._swipe = swipe

    const add = (f, x, y) => { f.x = x; f.y = y; this.addChild(f); this._fields.push(f); return f }
    this._provider = add(field(10, TEXT_GREY), LEFT, -88)
    this._mission = add(field(15), LEFT, -69)
    this._countdown = add(field(26), LEFT, -42)
    this._rocket = add(field(12), LEFT, -17)
    this._when = add(field(11, TEXT_GREY), LEFT, 1)
    this._pad = add(field(11), LEFT, 18)
    this._status = add(field(11, hex(this._accent)), LEFT, 35)
    this._weather = add(field(11, TEXT_GREY), LEFT, 52)
    this._position = add(field(10, TEXT_GREY), LEFT, 82)
    this._credit = add(field(10, TEXT_GREY, 1), RIGHT + RIGHT_WIDTH, 89)
    this._credit.text = 'Launch Library 2 - The Space Devs'

    this._text = new PIXI.Text('', {
      fontFamily: 'ShareTechMono', fontSize: 13, fill: '#ffffff', wordWrap: true, wordWrapWidth: RIGHT_WIDTH, lineHeight: 17,
    })
    this._text.resolution = window.devicePixelRatio || 1
    this._text.roundPixels = true
    this._text.x = RIGHT
    this._text.y = TOP
    this.addChild(this._text)
  }

  _endDrag(x) {
    if(this._dragStartX === null || this._dragStartX === undefined) return
    const dx = x - this._dragStartX
    this._dragStartX = null
    if(Math.abs(dx) >= SWIPE_DISTANCE) this.emit('swipe', dx < 0 ? 1 : -1)
  }

  // l: a launch from LaunchesService (or null); index/count: its place in the list
  show(l, index, count) {
    this._position.text = count > 1 ? `${index + 1} / ${count}   < swipe for other launches >` : ''
    if(l === this._launch) return
    this._launch = l
    if(!l) {
      for(const f of this._fields) if(f !== this._credit && f !== this._position) f.text = ''
      this._fit('No launch data yet.')
      return
    }
    this._provider.text = [l.provider, l.missionType].filter(Boolean).join('  -  ')
    this._mission.text = cut(l.mission, 30)
    this._rocket.text = cut(l.rocket, 34)
    const windowLength = exact(l) && l.windowStart && l.windowEnd ? l.windowEnd - l.windowStart : null
    this._when.text = when(l) + (windowLength > 0 ? `   window ${minutes(windowLength)}` : windowLength === 0 ? '   instant window' : '')
    this._pad.text = cut([l.pad, site(l)].filter(Boolean).join(', '), 40)
    this._status.text = cut([l.statusName || l.status, l.orbit && `to ${l.orbit}`].filter(Boolean).join('  -  '), 40)
    this._status.style.fill = GOOD.includes(l.status) ? hex(this._accent) : '#ffffff'
    this._weather.text = Number.isFinite(l.probability) ? `weather ${l.probability}% go` : ''
    const notes = [l.description, l.weather && `Weather: ${l.weather}`, l.failReason && `Failure: ${l.failReason}`].filter(Boolean)
    this._fit(notes.join('\n\n') || 'No mission description.')
    this._lastCountdown = null
  }

  // the largest font size (13 down to 10) at which the text fits
  _fit(text) {
    const style = this._text.style
    for(let size = 13; size >= 10; size--) {
      style.fontSize = size
      style.lineHeight = Math.round(size * 1.3)
      if(PIXI.TextMetrics.measureText(text, style).height <= BOTTOM - TOP) break
    }
    this._text.text = text
  }

  render(renderer) {
    // the countdown is the only text that changes by itself: set it only when it does
    const text = this._launch ? countdown(this._launch, Date.now()) : ''
    if(text !== this._lastCountdown) {
      this._lastCountdown = text
      this._countdown.text = text
    }
    this._fields.forEach(f => f.progress = this.progress)
    this._text.alpha = this.progress
    this._swipe.visible = this.progress > 0.5
    super.render(renderer)
  }
}
