import { ACCENT } from '../../frontend/theme.js'
import TextField, { TEXT_GREY } from '../../frontend/components/TextField'
import ScrollContainer from '../../frontend/components/ScrollContainer.js'
import { when, countdown, site, cut, exact, clock, GOOD } from './format.js'

// The NEXT tab: one launch in detail. Left: provider, mission, a live
// countdown, rocket, time and window, pad, orbit, status and launch weather.
// Right: the mission description and more details (status, window,
// programs, this year's launch counts) in mixed case, scrolled by dragging
// up and down, and the credit. Swiping left or right emits 'swipe' (+1 = the next launch).
// The page spans about x -295..295, y -105..98.

const LEFT = -282
const RIGHT = 20
const RIGHT_WIDTH = 262
const TOP = -90
const BOTTOM = 78
const TEXT_SIZE = 15
const SWIPE_DISTANCE = 30

const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th')
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
    this._credit.text = 'Launch Library 2'

    // the details scroll inside the right column; a thin bar on its right
    // edge shows where you are when there is more than fits
    this._scroll = new ScrollContainer(RIGHT_WIDTH, BOTTOM - TOP)
    this._scroll.x = RIGHT
    this._scroll.y = TOP
    this.addChild(this._scroll)
    this._text = new PIXI.Text('', {
      fontFamily: 'ShareTechMono', fontSize: TEXT_SIZE, fill: '#ffffff', wordWrap: true,
      wordWrapWidth: RIGHT_WIDTH - 8, lineHeight: Math.round(TEXT_SIZE * 1.3),
    })
    this._text.resolution = window.devicePixelRatio || 1
    this._text.roundPixels = true
    this._scroll.addChild(this._text)
    this._scrollBar = new PIXI.Graphics()
    this._scrollBar.x = RIGHT + RIGHT_WIDTH - 2
    this._scrollBar.y = TOP
    this.addChild(this._scrollBar)
    this._scrollHint = add(field(10, TEXT_GREY), RIGHT, 89)
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
      for(const f of this._fields) if(f !== this._credit && f !== this._position && f !== this._scrollHint) f.text = ''
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
    this._fit(this._details(l))
    this._lastCountdown = null
  }

  // the scrolling text: description, then details as short paragraphs
  _details(l) {
    const parts = [l.description || 'No mission description.']
    if(l.failReason) parts.push(`Failure: ${l.failReason}`)
    if(l.statusDescription) parts.push(`${l.statusName || l.status}: ${l.statusDescription}`)
    if(l.weather) parts.push(`Weather concerns: ${l.weather}`)
    if(exact(l) && l.windowStart && l.windowEnd) {
      parts.push(l.windowEnd > l.windowStart
        ? `Window: ${clock(l.windowStart)} to ${clock(l.windowEnd)} local time.`
        : `Instantaneous window at ${clock(l.windowStart)} local time.`)
    }
    if(l.programs && l.programs.length) parts.push(`Program: ${l.programs.join(', ')}.`)
    const c = l.countYear || {}
    const year = new Date(l.net).getFullYear()
    const counts = [
      Number.isFinite(c.provider) && `${ordinal(c.provider)} launch for ${l.provider || 'this provider'}`,
      Number.isFinite(c.orbital) && `${ordinal(c.orbital)} orbital launch attempt worldwide`,
      Number.isFinite(c.pad) && l.pad && `${ordinal(c.pad)} from ${l.pad}`,
    ].filter(Boolean)
    if(counts.length) parts.push(`In ${year}: ${counts.join('; ')}.`)
    const who = [l.provider, l.providerType && `(${l.providerType.toLowerCase()})`].filter(Boolean).join(' ')
    if(who) parts.push(`Launch provider: ${who}.`)
    return parts.join('\n\n')
  }

  _fit(text) {
    this._text.text = text
    const height = this._text.height
    this._scroll.contentRect = { x: 0, y: 0, width: RIGHT_WIDTH, height: height + 6 }
    this._scroll.scrollTo(0, 0)
    this._overflow = height + 6 > BOTTOM - TOP
    this._scrollHint.text = this._overflow ? 'drag text up for more' : ''
    this._barAt = null
  }

  // the scroll bar: track and thumb, redrawn only when the text moves
  _drawBar() {
    const view = BOTTOM - TOP
    const content = this._scroll.contentRect.height
    const y = -this._scroll._content.y
    const key = this._overflow ? Math.round(y) : -1
    if(key === this._barAt) return
    this._barAt = key
    const g = this._scrollBar
    g.clear()
    if(!this._overflow) return
    g.beginFill(0xffffff, 0.15)
    g.drawRect(0, 0, 2, view)
    g.endFill()
    const thumb = Math.max(16, view * view / content)
    g.beginFill(this._accent)
    g.drawRect(0, (view - thumb) * y / (content - view), 2, thumb)
    g.endFill()
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
    this._drawBar()
    this._scrollBar.alpha = this.progress
    this._scroll.scroller.visible = this.progress > 0.5
    this._swipe.visible = this.progress > 0.5
    super.render(renderer)
  }
}
