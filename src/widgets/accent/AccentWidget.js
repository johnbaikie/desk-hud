import Widget from '../../frontend/Widget.js'
import TextField from '../../frontend/components/TextField.js'
import { ACCENT, BASE_ACCENT, DEFAULT_ACCENT, RAINBOW, hueToColor, saveAccent, saveRainbow } from '../../frontend/theme.js'

// Picks the accent colour used by every widget, or rainbow mode (a random
// colour per widget). There is no service: the setting is kept in the browser
// (see frontend/theme.js) and applied by reloading the page.

const PRESETS = [
  DEFAULT_ACCENT, // Matrix green
  0x00e5ff, // cyan
  0x2979ff, // blue
  0xb388ff, // violet
  0xff40c4, // magenta
  0xff1744, // red
  0xff9100, // orange
  0xffc400, // amber
  0xffee58, // yellow
  0xc6ff00, // lime
  0x1de9b6, // teal
  0xffffff, // white
]

// set before the reload so the picker opens again afterwards
const REOPEN_KEY = 'DeskHud_reopenAccent'

const SWATCH_RADIUS = 22
const HUE_BAR_WIDTH = 360
const HUE_BAR_X = -90 // leaves room for the rainbow button on the right
const RAINBOW_BUTTON = { x: 200, y: 62, width: 150, height: 36 }
const HUE_BAR_HEIGHT = 18

function toHex(color) {
  return '#' + color.toString(16).padStart(6, '0')
}

export default class AccentWidget extends Widget {
  constructor() {
    super('accent', 'Accent')
    this.initState({})
    this.updateState({}) // no service data to wait for

    this._applying = false
    // in rainbow mode this widget's own colour; ACCENT is reset after construction
    this._accent = ACCENT
    // the picked colour, unless rainbow mode replaces it
    this._current = RAINBOW ? null : BASE_ACCENT

    // circle: the preset colours around the edge, the current one in the middle
    this._ring = new PIXI.Graphics()
    this.addChild(this._ring)
    this._ringHash = ''

    this._label = new TextField(RAINBOW ? 'rainbow' : toHex(BASE_ACCENT), {
      fontFamily: 'ShareTechMono',
      fontSize: 13,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: 0.5,
      align: 'center',
    })
    this.addChild(this._label)

    // main screen
    this.main.title = 'Accent Color'
    this.main.statusLeftText = 'now ' + (RAINBOW ? 'rainbow mode' : toHex(BASE_ACCENT))
    this.main.statusRightText = 'tap a color to apply'
    const page = this.main.getPage(0)

    this._swatches = PRESETS.map((color, i) => {
      const swatch = new PIXI.Graphics()
      swatch.x = -225 + (i % 6) * 90
      swatch.y = -55 + Math.floor(i / 6) * 62
      swatch.beginFill(color)
      swatch.drawCircle(0, 0, SWATCH_RADIUS)
      swatch.endFill()
      if(color === this._current) {
        swatch.lineStyle({ width: 2, color: 0xffffff })
        swatch.drawCircle(0, 0, SWATCH_RADIUS + 6)
      }
      swatch.hitArea = new PIXI.Circle(0, 0, SWATCH_RADIUS + 10)
      swatch.interactive = true
      swatch.cursor = 'pointer'
      swatch.on('pointertap', () => this._apply(color))
      page.addChild(swatch)
      return swatch
    })

    // hue bar for colours between the presets: drag to preview, release to apply
    this._hueBar = new PIXI.Graphics()
    this._hueBar.x = HUE_BAR_X
    this._hueBar.y = 62
    const steps = 96
    for(let i = 0; i < steps; i++) {
      this._hueBar.beginFill(hueToColor(i / steps))
      this._hueBar.drawRect(-HUE_BAR_WIDTH/2 + i*HUE_BAR_WIDTH/steps, -HUE_BAR_HEIGHT/2, HUE_BAR_WIDTH/steps + 0.5, HUE_BAR_HEIGHT)
    }
    this._hueBar.endFill()
    this._hueBar.hitArea = new PIXI.Rectangle(-HUE_BAR_WIDTH/2 - 10, -HUE_BAR_HEIGHT/2 - 14, HUE_BAR_WIDTH + 20, HUE_BAR_HEIGHT + 28)
    this._hueBar.interactive = true
    page.addChild(this._hueBar)

    this._hueMarker = new PIXI.Graphics()
    this._hueMarker.lineStyle({ width: 2, color: 0xffffff })
    this._hueMarker.drawRect(-4, -HUE_BAR_HEIGHT/2 - 5, 8, HUE_BAR_HEIGHT + 10)
    this._hueMarker.visible = false
    this._hueBar.addChild(this._hueMarker)

    this._hueLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 11,
      fill: '#ffffff',
      align: 'center',
    })
    this._hueLabel.x = HUE_BAR_X
    this._hueLabel.y = 90
    page.addChild(this._hueLabel)

    this._dragging = false
    this._hueBar.on('pointerdown', (e) => { this._dragging = true; this._previewHue(e) })
    this._hueBar.on('globalpointermove', (e) => { if(this._dragging) this._previewHue(e) })
    this._hueBar.on('pointerup', (e) => this._endHueDrag(e))
    this._hueBar.on('pointerupoutside', (e) => this._endHueDrag(e))
    this._hueBar.on('pointercancel', () => { this._dragging = false; this._hueMarker.visible = false })
    this._previewColor = null

    this._rainbowButton = this._createRainbowButton()
    page.addChild(this._rainbowButton)

    try {
      this._reopen = window.sessionStorage.getItem(REOPEN_KEY) === '1'
      window.sessionStorage.removeItem(REOPEN_KEY)
    } catch(e) {
      this._reopen = false
    }
  }

  _hueAt(e) {
    const x = e.getLocalPosition(this._hueBar).x
    const t = Math.max(0, Math.min(0.999, (x + HUE_BAR_WIDTH/2) / HUE_BAR_WIDTH))
    return { x: t*HUE_BAR_WIDTH - HUE_BAR_WIDTH/2, color: hueToColor(t) }
  }

  _previewHue(e) {
    const { x, color } = this._hueAt(e)
    this._hueMarker.x = x
    this._hueMarker.visible = true
    this._previewColor = color
    this._hueLabel.text = 'release to apply ' + toHex(color)
  }

  _endHueDrag(e) {
    if(!this._dragging) return
    this._dragging = false
    this._previewHue(e)
    this._apply(this._previewColor)
  }

  _apply(color) {
    if(this._applying || color === null) return
    if(color === this._current) {
      this._hueMarker.visible = false
      this._hueLabel.text = ''
      return
    }
    this._applying = true
    this._hueLabel.text = 'applying ' + toHex(color) + '...'
    if(!saveAccent(color)) {
      this._applying = false
      this._hueLabel.text = 'could not save the color'
      return
    }
    this._reload()
  }

  _toggleRainbow() {
    if(this._applying) return
    this._applying = true
    this._hueLabel.text = RAINBOW ? 'turning rainbow mode off...' : 'picking random colors...'
    if(!saveRainbow(!RAINBOW)) {
      this._applying = false
      this._hueLabel.text = 'could not save the setting'
      return
    }
    this._reload()
  }

  _reload() {
    try { window.sessionStorage.setItem(REOPEN_KEY, '1') } catch(e) { }
    // every widget reads the accent when it is built, so start over
    setTimeout(() => window.location.reload(), 150)
  }

  _createRainbowButton() {
    const { x, y, width, height } = RAINBOW_BUTTON
    const button = new PIXI.Container()
    button.x = x
    button.y = y

    const bg = new PIXI.Graphics()
    bg.beginFill(0x000000)
    bg.drawRect(-width/2, -height/2, width, height)
    // rainbow strip along the bottom edge
    const steps = 30
    for(let i = 0; i < steps; i++) {
      bg.beginFill(hueToColor(i / steps))
      bg.drawRect(-width/2 + i*width/steps, height/2 - 7, width/steps + 0.5, 7)
    }
    bg.endFill()
    bg.lineStyle({ width: RAINBOW ? 2 : 1, color: 0xffffff, alpha: RAINBOW ? 1 : 0.6 })
    bg.drawRect(-width/2, -height/2, width, height)
    if(RAINBOW) {
      // selected, like the current swatch
      bg.drawRect(-width/2 - 5, -height/2 - 5, width + 10, height + 10)
    }
    button.addChild(bg)

    const label = new TextField('Rainbow Mode', {
      fontFamily: 'ShareTechMono',
      fontSize: 12,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: 0.5,
      align: 'center',
    })
    label.y = -4
    label.progress = 1
    button.addChild(label)
    this._rainbowLabel = label

    const note = new TextField(RAINBOW ? 'on: tap to turn off' : 'a color per widget', {
      fontFamily: 'ShareTechMono',
      fontSize: 10,
      fill: '#ffffff',
      align: 'center',
    })
    note.y = height/2 + 16
    note.alpha = 0.6
    button.addChild(note)
    this._rainbowNote = note

    button.hitArea = new PIXI.Rectangle(-width/2 - 8, -height/2 - 8, width + 16, height + 16)
    button.interactive = true
    button.cursor = 'pointer'
    button.on('pointertap', () => this._toggleRainbow())
    return button
  }

  render(renderer) {
    if(this._reopen && this.parent) {
      // after applying a colour: show the picker again (once it is on stage)
      this._reopen = false
      this.emit('activate')
    }
    const p = this.progress * this.dataLoadProgress
    const hash = `${this.size.toFixed(3)}|${p.toFixed(3)}`
    if(hash !== this._ringHash) {
      this._ringHash = hash
      this._ring.clear()
      const a = 2*Math.PI / PRESETS.length
      PRESETS.forEach((color, i) => {
        const r = (color === this._current ? 9 : 6) * this.size * p
        this._ring.beginFill(color)
        this._ring.drawCircle(75*this.size*Math.sin(i*a), -75*this.size*Math.cos(i*a), r)
      })
      this._ring.beginFill(this._accent)
      this._ring.drawCircle(0, -12*this.size, 22*this.size*p)
      this._ring.endFill()
    }

    this._label.progress = p
    this._label.y = 32*this.size
    this._label.visible = this.size === 1

    const mp = this.main.progress
    this._swatches.forEach(s => {
      s.scale.set(mp)
      s.visible = mp > 0
    })
    this._hueBar.scale.set(mp, 1)
    this._hueBar.visible = mp > 0
    this._hueLabel.progress = mp
    this._rainbowButton.scale.set(mp)
    this._rainbowButton.visible = mp > 0
    this._rainbowLabel.progress = mp
    this._rainbowNote.progress = mp

    super.render(renderer)
  }
}
