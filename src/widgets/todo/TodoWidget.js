import Widget from '../../frontend/Widget.js'
import TimelineCircle from '../../frontend/circles/TimelineCircle.js'
import TickCircle from '../../frontend/circles/TickCircle.js'
import DotCluster from '../../frontend/components/DotCluster.js'
import ScaleCircle from '../../frontend/circles/ScaleCircle.js'
import ProgressCircle from '../../frontend/circles/ProgressCircle.js'
import TodoListScreen from './TodoListScreen.js'
import AuthErrorScreen from '../calendar/lib/AuthErrorScreen.js'

export default class TodoWidget extends Widget {
  constructor() {
    super('todo', "Tasks")
    this.dataLoadProgress = 0
    this.initState({
      tasks: null,
    })

    this._scaleLarge = new TickCircle()
    this._scaleLarge.count = 8
    this._scaleLarge.countMax = 7
    this._scaleLarge.rotation = Math.PI/4
    this._scaleLarge.length = 0.2
    this.addChild(this._scaleLarge)

    this._inboxFrame = new ProgressCircle()
    this._inboxFrame.size = 0.51
    this._inboxFrame.value = 1
    this._inboxFrame.lineWidth = 1
    this._inboxFrame.alpha = 0.5
    this.addChild(this._inboxFrame)

    this._timeScale = new ScaleCircle(0, 24, 'h', 7, Math.PI*1.5)
    this._timeScale.rotation = Math.PI*0.25
    this.addChild(this._timeScale)

    this._dotCluster = new DotCluster()
    this._dotCluster.title = 'to do'
    this.addChild(this._dotCluster)

    this._timeline = new TimelineCircle(0, 1000*60*60*24, Math.PI*1.5)

    this.addChild(this._timeline)

    // main screen
    this.main.title = "Tasks"
    const page = this.main.getPage(0)
   
    this._todoListScreen = new TodoListScreen()
    page.addChild(this._todoListScreen)

    this._todoListScreen.on('complete', (id) => this._setCompleted(id, true))
    this._todoListScreen.on('uncomplete', (id) => this._setCompleted(id, false))

    this.main.setCustomErrorScreen(new AuthErrorScreen(() => this.sendMessage({action: 'auth'})))

  }

  // update the list and counts right away; the service confirms with a refresh
  _setCompleted(id, completed) {
    if(this.state.tasks) {
      this.updateState({tasks: this.state.tasks.map(t => t.id !== id ? t : {
        ...t,
        status: completed ? 'completed' : 'needsAction',
        completed: completed ? new Date().getTime() : null,
      })})
      this._updateTimeline()
    }
    this.sendMessage({action: completed ? 'complete' : 'uncomplete', id})
  }

  _updateTimeline() {
    const today = Math.floor((new Date().getTime())/(1000*60*60*24))*(1000*60*60*24) + new Date().getTimezoneOffset()*60000
    this._timeline.setPoints(this.state.tasks.map(i => i.completed ? i.completed - today : null))
  }

  onMessage(msg) {
    super.onMessage(msg)
    if(this.state.tasks) {
      this._updateTimeline()
    }
  }

  msg2state(msg) {
    if(msg.authUrl) {
      window.location.href = msg.authUrl
      return  {}
    }
    if(!Array.isArray(msg.tasks)) {
      return {error: msg.error || 'No task data'}
    }
    return {
      lastUpdate: new Date().getTime(),
      tasks: msg.tasks,
      error: msg.error || null,
    }
  }

  render(renderer) {
    super.render(renderer)

    const today = Math.floor((new Date().getTime())/(1000*60*60*24))*(1000*60*60*24) + new Date().getTimezoneOffset()*60000

    this._dotCluster.count = this.state.tasks ? this.state.tasks.filter(t => !t.completed).length : 0
    this._dotCluster.progress = this.progress * this.dataLoadProgress

    this._timeline.progress = this.progress * this.dataLoadProgress
    this._timeline.size = this.size
    this._timeline.now = new Date().getTime() - today

    this._scaleLarge.progress = this.progress
    this._scaleLarge.size = this.size
    this._scaleLarge.visible = this.size === 1

    this._timeScale.progress = this.progress
    this._timeScale.size = this.size*1.05

    this._timeScale.value = (this._timeline.now)/(1000*60*60)
    this._timeScale.visible = this.size === 1
    
    this._inboxFrame.progress = this.progress
    this._inboxFrame.visible = this.size === 1
    
    this._todoListScreen.progress = this.main.progress * this.dataLoadProgress
    this._todoListScreen.tasks = this.state.tasks
  }
}