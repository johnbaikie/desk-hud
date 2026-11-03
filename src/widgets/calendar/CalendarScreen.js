import LineArt from "../../frontend/components/LineArt"
import TextField from "../../frontend/components/TextField"

const BUSY_SCALE_STEP = 11.4
const SWIPE_DISTANCE = 30 // px of horizontal drag that counts as a swipe

export default class CalendarScreen extends PIXI.Container {
  constructor() {
    super()
    this.progress = 0

    this.events = null
    this.allDayEvents = null
    // false while showing another day: list the whole day, no "now" pointer
    this.isToday = true

    this._agenda = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 11,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'left',
    })
    this._agenda.anchor.set(0, 0)
    this.addChild(this._agenda)
    this._agenda.x = -140 // right of the separator line at x=-150
    this._agenda.y = -80

    this._agendaTimes = new TextField('', this._agenda.style)
    this._agendaTimes.anchor.set(0, 0)
    this.addChild(this._agendaTimes)
    this._agendaTimes.x = -270
    this._agendaTimes.y = -80

    this._bg = new LineArt()
    this._bg.addLine(-150, -105, -150, 80, 1, 0xffffff)
    this._bg.addLine(200, -105, 200, 95)
    for(let i=0; i < 15; i++) {
      this._bg.addLine(200, -76+i*BUSY_SCALE_STEP, 250, -76+i*BUSY_SCALE_STEP, 1, 0x00ff41)
    }

    this.addChild(this._bg)

    const hours = Array(15).fill(1)
      .map((_, i) => `${String(i+6).padStart(2, '0')}:00`)
      .join('\n')

    this._timeScale = new TextField(hours, {
      fontFamily: 'ShareTechMono',
      fontSize: 10,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 1.5,
      align: 'right',
    })
    this._timeScale.y = -85
    this._timeScale.x = 290
    this._timeScale.anchor.set(1, 0)
    this._timeScale.scale.set(1) // lines match BUSY_SCALE_STEP ticks; keep unscaled
    this.addChild(this._timeScale)

    this._busyCanvas = new PIXI.Graphics()
    this._busyCanvas.x = 200
    this._busyCanvas.y = -76
    this.addChild(this._busyCanvas)

    this._busyPointer = new PIXI.Graphics()
    this._busyPointer.beginFill(0xffffff)
    this._busyPointer.moveTo(0, -5)
    this._busyPointer.lineTo(5, 0)
    this._busyPointer.lineTo(0, 5)
    this._busyPointer.lineTo(-2, 5)
    this._busyPointer.lineTo(-2, -5)
    this._busyPointer.lineTo(0, -5)
    this._busyPointer.endFill()
    this._busyPointer.lineStyle({
      width: 1,
      color: 0xffffff
    })
    this._busyPointer.moveTo(0, 0)
    this._busyPointer.lineTo(15, 0)
    this._busyPointer.x = this._busyCanvas.x
    this._busyPointer.y = this._busyCanvas.y
    this.addChild(this._busyPointer)

    // swipe area over the screen: swiping left emits 'swipe' with +1 (next
    // day), right with -1. Tracked from press to release so an interrupted
    // drag never leaves it stuck.
    this._swipeArea = new PIXI.Graphics()
    this._swipeArea.beginFill(0x000000, 0.0001)
    this._swipeArea.drawRect(-290, -100, 580, 205)
    this._swipeArea.interactive = true
    this.addChild(this._swipeArea)
    this._dragStartX = null
    this._swipeArea.on('pointerdown', (e) => { this._dragStartX = e.global.x })
    this._swipeArea.on('pointerup', (e) => this._endDrag(e.global.x))
    this._swipeArea.on('pointerupoutside', (e) => this._endDrag(e.global.x))
    this._swipeArea.on('pointercancel', () => { this._dragStartX = null })
    this.on('removed', () => { this._dragStartX = null })
  }

  _endDrag(x) {
    if(this._dragStartX === null) return
    const dx = x - this._dragStartX
    this._dragStartX = null
    if(Math.abs(dx) >= SWIPE_DISTANCE) {
      this.emit('swipe', dx < 0 ? 1 : -1)
    }
  }

  render(renderer) {
    this._agenda.progress = this.progress
    this._agendaTimes.progress = this.progress
    this._timeScale.progress = this.progress
    this._bg.progress = this.progress
    this._swipeArea.visible = this.progress > 0.5

    const now = new Date()

    const formatTime = (t) => {
      const date = new Date(t)

      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }

    if(this.events) {
      const allDay = this.allDayEvents || []
      const upcoming = this.events
        .filter(e => !this.isToday || e.end >= now.getTime())
        .slice(0, Math.max(0, 11 - allDay.length))
      const title = (e) => (e.summary || '(no title)').substring(0, 41)
      this._agendaTimes.text = [
        ...allDay.map(() => 'all day'),
        ...upcoming.map(e => `${formatTime(e.start)} - ${formatTime(e.end)}`),
      ].join('\n')
      this._agenda.text = [...allDay.map(title), ...upcoming.map(title)].join('\n') || (this.isToday ? 'no more meetings today' : 'no meetings')


      this._busyCanvas.clear()
      this._busyCanvas.beginFill(0x00ff41)
      for(let event of this.events) {
        if(event.allDay) continue
        let startY = new Date(event.start)
        let endY = new Date(event.end)
        startY = startY.getHours() + startY.getMinutes()/60
        startY = Math.min(20, Math.max(6, startY))
        startY = (startY-6)*BUSY_SCALE_STEP
        endY = endY.getHours() + endY.getMinutes()/60
        endY = Math.min(20, Math.max(6, endY))
        endY = (endY-6)*BUSY_SCALE_STEP
        if(startY === endY) continue

        this._busyCanvas.drawRect(5, startY, 40, endY - startY)
      }
    }
    this._busyCanvas.scale.set(this.progress, 1)
    this._busyPointer.alpha = this.isToday ? this.progress : 0

    let pointerY = now.getHours() + now.getMinutes()/60
    pointerY = Math.min(20, Math.max(6, pointerY))
    pointerY = (pointerY-6)*BUSY_SCALE_STEP
    this._busyPointer.y = pointerY - 76

    super.render(renderer)
  }
}