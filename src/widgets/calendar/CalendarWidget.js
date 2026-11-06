import { ACCENT } from '../../frontend/theme.js'
import Widget from '../../frontend/Widget.js'
import { startOfDay } from '../../frontend/time.js'
import ProgressCircle from '../../frontend/circles/ProgressCircle.js';
import TickCircle from '../../frontend/circles/TickCircle.js';
import ArchText from '../../frontend/components/ArchText.js';
import GaugePointer from '../../frontend/components/GaugePointer.js';
import TextField from '../../frontend/components/TextField.js';
import CalendarScreen from './CalendarScreen.js';
import AuthErrorScreen from './lib/AuthErrorScreen.js';
import ErrorScreen from '../../frontend/ErrorScreen.js';

// the main screen goes back to today after this long without a swipe or tap
const DAY_RESET_TIME = 2*60*1000
const DAY = 24*60*60*1000
// main-screen tabs; the services' widget ids map onto them
const TAB_WORK = 0
const TAB_PERSONAL = 1
const SOURCES = { outlook: 'work', calendar: 'personal' }
const TAB_SOURCE = ['work', 'personal']
const TAB_NAMES = ['Work', 'Personal']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default class CalendarWidget extends Widget {
  // One widget for both calendars: the Google service ('calendar') is the
  // Personal tab and the Outlook ICS service ('outlook') the Work tab. The
  // circle sums up today across both.
  constructor() {
    super('calendar', 'Calendar')
    // WidgetContainer routes these services' messages here
    this.messageIds = ['calendar', 'outlook']
    this.initState({
      sources: { work: { events: null, error: null }, personal: { events: null, error: null } },
      todayEvents: null,
      todayEventsLeft: null,
      todayAllDay: null,
    })

    this._statsTitle = new TextField('completed\ntoday', {
      fontFamily: 'ShareTechMono',
      fontSize: 10,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'center',
    });
    this.addChild(this._statsTitle)
    this._statsLabel = new TextField('0/0', {
      fontFamily: 'ShareTechMono',
      fontSize: 15,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 0.5,
      align: 'center',
    });
    this.addChild(this._statsLabel)

    this._statusProgress = new ProgressCircle()
    this._statusProgress.color = ACCENT
    this._statusProgress.lineWidth = 2
    this._statusProgress.rotation = Math.PI/2
    this.addChild(this._statusProgress)

    this._nextLabel = new ArchText()
    this._nextLabel.color = 0xffffff
    this._nextMeetingLabel = new ArchText()
    this._nextLabel.alignOffset = 0
    this._nextMeetingLabel.alignOffset = 0
    this._nextLabel.positionOffset = -Math.PI * 0.37
    this._nextLabel.fontSize = 11
    this._nextMeetingLabel.fontSize = 11
    this.addChild(this._nextMeetingLabel)
    this.addChild(this._nextLabel)

    this._meetingClock = new PIXI.Container()
    this.addChild(this._meetingClock)

    this._clockAlert = new PIXI.Graphics()
    this._clockAlert.beginFill(ACCENT)
    this._clockAlert.drawCircle(0, 0, 40)
    this._meetingClock.addChild(this._clockAlert)
    this._clockAlert.visible = false

    this._clockScale = new TickCircle()
    this._clockScale.count = 60
    this._clockScale.length = 0.1
    this._meetingClock.addChild(this._clockScale)

    this._clockSplit = new TickCircle()
    this._clockSplit.count = 6
    this._clockSplit.length = 0.5
    this._meetingClock.addChild(this._clockSplit)

    this._clockFrame = new ProgressCircle()
    this._clockFrame.value = 1
    this._clockFrame.lineWidth = 1.5
    this._meetingClock.addChild(this._clockFrame)

    this._clockPointer = new GaugePointer()
    this._meetingClock.addChild(this._clockPointer)

    this._clockCenter = new PIXI.Graphics()
    this._clockCenter.lineStyle({
      color: 0xaaaaaa,
      width: 1,
    })
    this._clockCenter.drawCircle(0, 0, 10)
    this._clockCenter.drawCircle(0, 0, 1)
    this._clockCenter.alpha = 0
    this._meetingClock.addChild(this._clockCenter)

    this._clockTitle = new ArchText()
    this._meetingClock.addChild(this._clockTitle)

    // main screen: a Work and a Personal tab, each a day of one calendar;
    // left/right swipes change the day on both
    this.main.statusRightText = '< swipe: other days >'
    this._screens = TAB_NAMES.map((name, i) => {
      const tab = this.main.getTabButton(i)
      tab.text = name
      tab.visible = true
      const screen = new CalendarScreen()
      screen.on('swipe', (step) => this._selectDay(this._dayOffset + step))
      this.main.getPage(i).addChild(screen)
      return screen
    })
    // each tab shows its own source's problem instead of the whole widget
    // going into its error state; Google can be signed into again from here
    this._errorScreens = [
      new ErrorScreen(),
      new AuthErrorScreen(() => this.sendMessage({action: 'auth'})),
    ]
    this._errorScreens.forEach((screen, i) => {
      screen.visible = false
      this.main.getPage(i).addChild(screen)
    })

    // day shown on the main screen, in days from today
    this._dayOffset = 0
    this._dayOffsetAt = 0
    this._dayCache = {}
  }

  // the services load this month and next, matching the DATE tab
  _offsetRange() {
    const now = new Date()
    const today = startOfDay()
    const first = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const last = new Date(now.getFullYear(), now.getMonth() + 2, 0).getTime()
    return [Math.round((first - today)/DAY), Math.round((last - today)/DAY)]
  }

  // show a date (ms) on the main screen; used by the Date & Time widget
  showDate(time) {
    this._selectDay(Math.round((startOfDay(time) - startOfDay())/DAY))
  }

  _selectDay(offset) {
    const [min, max] = this._offsetRange()
    this._dayOffset = Math.max(min, Math.min(max, offset))
    this._dayOffsetAt = Date.now()
  }

  // timed and all-day events of one source on the day `offset` days from
  // today, cached until the day, the offset or the events change
  _dayEvents(source, offset) {
    const d = new Date(startOfDay())
    d.setDate(d.getDate() + offset) // calendar days, so DST changes don't shift it
    const dayStart = d.getTime()
    d.setDate(d.getDate() + 1)
    const dayEnd = d.getTime()
    const all = this.state.sources[source].events
    const c = this._dayCache[source]
    if(c && c.dayStart === dayStart && c.all === all) return c

    this._dayCache[source] = {
      dayStart,
      all,
      events: all && all.filter(e => !e.allDay && e.start < dayEnd && e.end > dayStart),
      allDay: all && all.filter(e => e.allDay && e.start < dayEnd && e.end > dayStart),
    }
    return this._dayCache[source]
  }

  msg2state(msg, serviceId = 'calendar') {
    if(msg.authUrl) {
      window.location.href = msg.authUrl
      return  {}
    }
    const key = SOURCES[serviceId] || 'personal'
    const previous = this.state.sources[key]
    const sources = {
      ...this.state.sources,
      // an error-only update keeps the last events on screen
      [key]: { events: msg.allEvents || previous.events, error: msg.error || null },
    }

    // today across both calendars, for the circle
    const today = startOfDay()
    const tomorrow = today + DAY
    const all = [...(sources.work.events || []), ...(sources.personal.events || [])]
      .sort((a, b) => a.start - b.start)
    const todayEvents = all.filter(e => !e.allDay && e.start < tomorrow && e.end > today)
    return {
      sources,
      todayEvents,
      todayEventsLeft: todayEvents.filter(e => e.end >= Date.now()),
      // all-day events are listed but kept out of the meeting count, clock and busy bar
      todayAllDay: all.filter(e => e.allDay && e.start < tomorrow && e.end > today),
      // the circle's error overlay only when neither calendar has anything
      error: (sources.work.error && sources.personal.error && !all.length) ? sources.personal.error : null,
    }
  }

  render(renderer) {
    super.render(renderer)

    const now = new Date().getTime()

    this._statsLabel.progress = this.progress * this.dataLoadProgress
    this._statsTitle.progress = this.progress * this.dataLoadProgress
    this._statsLabel.y = 25 * this.size - 120*Math.max(0, this.size - 0.5)
    this._statsTitle.y = -20 * this.size - 80*Math.max(0, this.size - 0.5)
    this._statusProgress.progress = this.progress * this.dataLoadProgress
    this._statusProgress.size = this.size
    if(this.state.todayEvents && this.state.todayEventsLeft) {
      const completedEvents = this.state.todayEvents.length - this.state.todayEventsLeft.length
      const allEvents = this.state.todayEvents.length
      this._statsLabel.text = completedEvents + '/' + allEvents
      this._statusProgress.value = allEvents ? 0.5*((completedEvents)/allEvents) : 0
    }

    if(this.state.todayEventsLeft && this.state.todayEventsLeft.length > 0) {
      const upcomingMeetings = this.state.todayEvents.filter(e => e.start > now)
      if(upcomingMeetings.length > 0) {
        const eventTime = new Date(upcomingMeetings[0].start)
        const hh = (eventTime.getHours()).toString().padStart(2, '0')
        const mm = (eventTime.getMinutes()).toString().padStart(2, '0')
        this._nextMeetingLabel.visible = true
        this._nextMeetingLabel.radius = this.size * 105 + 5
        this._nextMeetingLabel.text = `${hh}:${mm} ${this.size === 1 ? upcomingMeetings[0].summary.substring(0, 40) : ''}`
        this._nextMeetingLabel.progress = this.progress * this.dataLoadProgress
        this._nextMeetingLabel.positionOffset = -Math.PI * 0.52 - 0.5*(1 - this.size)
        this._nextLabel.visible = true
        this._nextLabel.radius = this.size * 105 + 5
        this._nextLabel.text = 'next:'
        this._nextLabel.progress = this.progress * this.dataLoadProgress
        this._nextLabel.fontSize = 7 + this.size*4
        this._nextMeetingLabel.fontSize = 7 + this.size*4
      } else {
        this._nextMeetingLabel.visible = false
        this._nextLabel.visible = false
      }
    } else {
      this._nextMeetingLabel.visible = false
      this._nextLabel.visible = false
    }

    if(this.size === 1 && this.state.todayEvents) {
      const currentMeeting = this.state.todayEvents.find(e => e.start < now && e.end > now)
      let meetingProgress = 0
      let meetingTimeLeft = 0
      if(currentMeeting) {
        meetingTimeLeft = currentMeeting.end - now
        meetingProgress = (now - currentMeeting.start)/(currentMeeting.end - currentMeeting.start)
      }

      this._meetingClock.visible = true
      this._meetingClock.y = 40 * this.size
      this._clockScale.size = 0.4*this.size
      this._clockScale.progress = this.progress * this.dataLoadProgress
      this._clockSplit.size = 0.4 * this.size
      this._clockSplit.progress = this.progress * this.dataLoadProgress
      this._clockFrame.size = 0.45 * this.size
      this._clockFrame.progress = this.progress * this.dataLoadProgress

      this._clockPointer.size = 0.35
      this._clockPointer.progress = this.progress * this.dataLoadProgress
      this._clockCenter.alpha = this.progress * this.dataLoadProgress

      this._clockTitle.radius = 53
      this._clockTitle.progress = this.progress * this.dataLoadProgress
      this._clockTitle.text = currentMeeting ? "meeting clock" : "no meetings now"
      this._clockTitle.alpha = currentMeeting ? 1 : 0.4
      this._clockPointer.pointerRotation = 2 * Math.PI * meetingProgress
      this._clockPointer.visible = !!currentMeeting

      this._clockAlert.visible = true
      this._clockAlert.alpha = meetingTimeLeft > 0 && meetingTimeLeft < 5*60*1000 ? Math.sin(performance.now()*0.01)*0.4 + 0.4 : 0
      this._clockAlert.alpha *= this.progress * this.dataLoadProgress
    } else {
      this._meetingClock.visible = false
      this._clockAlert.visible = false
    }   
    if(this._dayOffset && Date.now() - this._dayOffsetAt > DAY_RESET_TIME) {
      this._dayOffset = 0
    }
    const mainProgress = this.main.progress * this.dataLoadProgress
    let dayLabel = 'Today'
    this._screens.forEach((screen, i) => {
      const source = this.state.sources[TAB_SOURCE[i]]
      const day = this._dayEvents(TAB_SOURCE[i], this._dayOffset)
      screen.progress = mainProgress
      screen.isToday = this._dayOffset === 0
      screen.events = day.events
      screen.allDayEvents = day.allDay
      if(this._dayOffset !== 0) {
        const date = new Date(day.dayStart)
        dayLabel = `${DAY_NAMES[date.getDay()]} ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`
      }
      // a source's error replaces its tab when there is nothing to show
      const failed = !!source.error && !(source.events && source.events.length)
      const errorScreen = this._errorScreens[i]
      errorScreen.visible = failed
      errorScreen.message = source.error
      errorScreen.progress = mainProgress
      screen.visible = !failed
    })
    const tab = this.main.getPage(TAB_PERSONAL).parent ? TAB_PERSONAL : TAB_WORK
    this.main.title = `${TAB_NAMES[tab]}: ${dayLabel}`
  }
}