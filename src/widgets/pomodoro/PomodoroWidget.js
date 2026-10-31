import Widget from '../../frontend/Widget.js'
import DotCircle from '../../frontend/circles/DotCircle.js'
import TickCircle from '../../frontend/circles/TickCircle.js'
import ArchText from '../../frontend/components/ArchText.js'
import GaugePointer from '../../frontend/components/GaugePointer.js'
import IconButton from '../../frontend/components/IconButton.js'
import PlayButton from '../../frontend/components/PlayButton.js'
import TextField from '../../frontend/components/TextField.js'
import PomodoroStatsScreen from './PomodoroStatsScreen.js'

const WORK_DURATION= 1000 * 25 * 60
const BREAK_DURATION = 1000 * 5 * 60
const SKIP_ICON = 0xe044 // Material Symbols "skip_next"

const otherMode = (mode) => mode === 'work' ? 'break' : 'work'

export default class PomodoroWidget extends Widget {
  constructor() {
    super('pomodoro', "Pomodoro")
    
    this.initState({
      history: null,
      stats: null
    })

    this._ticks = new TickCircle()
    this._ticks.count = 25
    this._ticks.length = 0.1
    this.addChild(this._ticks)

    this._redLight = new PIXI.Graphics()
    this._redLight.beginFill(0x00d8ff)
    this._redLight.drawCircle(0, 0, 100)
    this._redLight.alpha = 0
    this.addChildAt(this._redLight, 0)
    
    // _mode is the running session, or when idle the session play will start.
    // _timerStart is set only while a session runs.
    this._mode = localStorage.getItem('Pomodoro_mode') === 'break' ? 'break' : 'work'
    this._timerStart = Number(localStorage.getItem('Pomodoro_timerStart')) || null
    const oldTimerStop = Number(localStorage.getItem('Pomodoro_timerStop')) || null
    if(this._timerStart && oldTimerStop) {
      // saved by the previous version, which kept finished sessions as
      // start/stop times and switched mode when play was pressed
      if(oldTimerStop - this._timerStart >= this._getCurrentTimeLimit()) {
        this._mode = otherMode(this._mode)
      }
      this._timerStart = null
    }
    localStorage.removeItem('Pomodoro_timerStop')
    this._saveTimer()

    this._pulse = false

    this._playButton = new PlayButton()
    this._updatePlayButtonStatus()
    this._playButton.scale.set(0)
    this._playButton.on('play', () => {
      this._timerStart = new Date().getTime()
      this._pulse = false
      this._saveTimer()
    })
    this._playButton.on('stop', () => {
      // cancel and reset the same session; skip moves to the other one
      this._timerStart = null
      this._pulse = false
      this._saveTimer()
    })

    this._skipButton = new IconButton(SKIP_ICON)
    this._skipButton.scale.set(0)
    this._skipButton.on('pointertap', (e) => {
      e.stopPropagation()
      this._mode = otherMode(this._mode)
      this._timerStart = null
      this._pulse = false
      this._saveTimer()
      this._updatePlayButtonStatus()
    })

    this._workLabel = new ArchText()
    this._workLabel.text = 'Work'
    this._workLabel.positionOffset = 1.8
    this.addChild(this._workLabel)

    this._breakLabel = new ArchText()
    this._breakLabel.text = 'Break'
    this._breakLabel.color = 0xffffff
    this._breakLabel.positionOffset = 1.3
    this.addChild(this._breakLabel)

    this._modeLabel = new TextField('Work', {
      fontFamily: 'ShareTechMono',
      fontSize: 16,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'center',
    });
    this._modeLabel.anchor.set(0.5)
    this.addChild(this._modeLabel)

    this._pointer = new GaugePointer()
    this.addChild(this._pointer)

    this._clockCenter = new PIXI.Graphics()
    this._clockCenter.lineStyle({
      width: 2,
      alpha: 0.8,
      color: 0xffffff
    })
    this._clockCenter.drawCircle(0, 0, 10)
    this._clockCenter.beginFill(0xffffff)
    this._clockCenter.drawCircle(0, 0, 2)
    this.addChild(this._clockCenter)
    this._timeBg = new PIXI.Graphics()
    this._timeBg.beginFill(0x000000)
    this._timeBg.drawRect(-55, -9, 110, 20)
    this.addChild(this._timeBg)
   
    this._timeBgRed = new PIXI.Graphics()
    this._timeBgRed.beginFill(0x00d8ff)
    this._timeBgRed.drawRect(-55, -9, 110, 20)
    this._timeBgRed.alpha = 0
    this.addChild(this._timeBgRed)

    this._timeLabel = new TextField('00:00.000', {
      fontFamily: 'ShareTechMono',
      fontSize: 16,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'center',
    });
    this._timeLabel.anchor.set(0.5)

    this.addChild(this._timeLabel)
    this.addChild(this._playButton)
    this.addChild(this._skipButton)

    this._dotLabel = new ArchText()
    this._dotLabel.text = 'completed:'
    this._dotLabel.color = 0xffffff
    this._dotLabel.positionOffset = -1.6
    this._dotLabel.alpha = 0
    this.addChild(this._dotLabel)

    this._dots = new DotCircle()
    this._dots.rotation = 2.1
    this._dots.count = 40
    this._dots.countMax = 0
    this.addChild(this._dots)

    // main screen
    this.main.title = "Pomodoro stats"
    const page = this.main.getPage(0)
   
    this._statsScreen = new PomodoroStatsScreen()
    page.addChild(this._statsScreen)
  }

  msg2state(data) {
    const today = Math.floor((new Date().getTime())/(1000*60*60*24))
    return {
      history: data.history,
      stats:  data.history      
        .map(t => Math.floor(t/(1000*60*60*24) - today + 6))
        .filter(t => t >= 0)
        .reduce((s, v) => {
          s[v]++
          return s
        }, Array(7).fill(0))
    }
  }

  _saveTimer() {
    localStorage.setItem('Pomodoro_mode', this._mode)
    if(this._timerStart) {
      localStorage.setItem('Pomodoro_timerStart', this._timerStart)
    } else {
      localStorage.removeItem('Pomodoro_timerStart')
    }
  }

  _updatePlayButtonStatus() {
    this._playButton.mode = this._timerStart ? 'play' : 'stop'
  }

  _getCurrentTimeLimit() {
    return (this._mode === 'work') ? WORK_DURATION : BREAK_DURATION
  }

  // returns the elapsed fraction of the running session (0 when idle)
  _updateTimer() {
    if(!this._timerStart) return 0
    const dt = new Date().getTime() - this._timerStart
    const timeLimit = this._getCurrentTimeLimit()
    if(dt > timeLimit) {
      if(this._mode === 'work') {
        // pomodoro completed
        this.sendMessage({action: 'pomodoroDone'})
      }
      // finished: show the next session, ready to start
      this._mode = otherMode(this._mode)
      this._timerStart = null
      this._saveTimer()
      this._updatePlayButtonStatus()
      this._pulse = true
      return 0
    }
    return dt / timeLimit
  }

  render(renderer) {
    super.render(renderer)

    const timeProggress = this._updateTimer()

    const now = new Date().getTime()
    let dt = this._timerStart ? now - this._timerStart : 0
    dt = Math.max(0, this._getCurrentTimeLimit() - dt)
    
    this._playButton.scale.set(this.progress*2*Math.max(0, this.size-0.5))
    this._playButton.visible = (0.8)
    this._playButton.x = -100*this.size * Math.cos(Math.PI*0.25)
    this._playButton.y = 100*this.size * Math.sin(Math.PI*0.25)

    this._skipButton.scale.set(0.75*this.progress*2*Math.max(0, this.size-0.5))
    this._skipButton.x = 100*this.size * Math.cos(Math.PI*0.25)
    this._skipButton.y = this._playButton.y

    this._timeLabel.progress = this.progress
    this._timeBg.alpha = this.progress
    this._timeLabel.y = -this.size * 40
    this._timeBg.y = this._timeLabel.y 
    this._timeBg.scale.x = 0.2 + 0.8*this.size
    this._timeBgRed.y = this._timeBg.y
    this._timeBgRed.scale.x = this._timeBg.scale.x
    if(this._pulse) {
      this._timeLabel.alpha = 0.6 + 0.4 * Math.sin(performance.now()*0.01)
      this._redLight.alpha =  (0.8 - 0.4 + 0.4 * Math.sin(performance.now()*0.01))*this.progress
      
    } else {
      this._timeLabel.alpha = 1
      this._redLight.alpha = 0
    }
    this._timeBgRed.alpha = this._redLight.alpha

    const mm = Math.floor(dt / (1000*60))
    const ss = Math.floor((dt - mm * 1000 * 60) / 1000)
    const ms = dt % 1000

    let timeText = `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
    if(this.size === 1) {
      timeText += `.${ms.toString().padStart(3, '0')}`
    }
    this._timeLabel.text = timeText

    this._modeLabel.progress = this.progress
    if(this.size === 1) {
      // large circle: spell out what the play button will start
      this._modeLabel.style.fontSize = 12
      this._modeLabel.y = 38
    } else {
      this._modeLabel.style.fontSize = this.size * 26
      this._modeLabel.y = this.size * 20
    }
    this._modeLabel.visible = (this.size <= 0.65 || this.size === 1)
    const nextPrefix = (this.size === 1 && !this._timerStart) ? 'next: ' : ''
    if(this._mode === 'work') {
      this._modeLabel.text = nextPrefix + 'work'
      this._modeLabel.style.fill = 0xffffff
      this._modeLabel.style.stroke = 0xffffff
      this._ticks.count = 25
    } else {
      this._modeLabel.text = nextPrefix + 'break'
      this._modeLabel.style.fill = 0xffffff
      this._modeLabel.style.stroke = 0xffffff
      this._ticks.count = 5
    }

    this._workLabel.radius = 110*this.size
    this._workLabel.progress = this.progress
    this._workLabel.fontSize = 12 * this.size
    this._workLabel.alpha = this._mode === 'work' ? 1 : 0.25
    this._workLabel.visible = (this.size === 1)
    this._breakLabel.radius = 110*this.size
    this._breakLabel.progress = this.progress
    this._breakLabel.fontSize = 12 * this.size
    this._breakLabel.alpha = this._mode === 'break' ? 1 : 0.25
    this._breakLabel.visible = (this.size === 1)

    this._pointer.progress = this.progress
    this._pointer.size = this.size*0.8
    this._pointer.alpha = Math.max(0, 2*(this.size-0.5))
    this._pointer.pointerRotation = Math.PI*2*timeProggress
    this._clockCenter.alpha = this.progress * 0.8 * Math.max(0, 2*(this.size-0.5))
    this._clockCenter.scale.set(this.size)

    this._redLight.scale.set(this.size*1.15)

    this._ticks.size = this.size*0.9
    this._ticks.progress = this.progress
    this._dots.size = this.size*1.1
    this._dots.progress = this.progress
    this._dots.visible = (this.size === 1)
    this._dotLabel.progress = this.progress
    this._dotLabel.radius = this.size * 113
    this._dotLabel.fontSize = 12 * this.size
    this._dotLabel.visible = (this.size === 1)
    const dayStart = Math.floor(now / (1000*60*60*24))*(1000*60*60*24)
    if(this.state.history) {
      this._dots.countMax = Math.min(10, this.state.history.filter(p => p > dayStart ).length)
    }
    this._dotLabel.alpha = this._dots.countMax > 0 ? 1 : 0
        
    this._statsScreen.progress = this.main.progress
    this._statsScreen.stats = this.state.stats
  }
}