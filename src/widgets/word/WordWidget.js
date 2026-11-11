import Widget from '../../frontend/Widget.js'
import { TEXT_GREY } from '../../frontend/components/TextField.js'
import ProgressCircle from '../../frontend/circles/ProgressCircle.js'
import { ACCENT } from '../../frontend/theme.js'
import WordScreen from './WordScreen.js'

// Merriam-Webster's Word of the Day from WordService.
// Circle: today's word (mixed case, sized to fit) and its part of speech.
// Main screen: WORD, IN USE and DID YOU KNOW tabs; swipe left or right on
// any of them for the earlier words in the feed (the last 10 days). After
// a while it goes back to today's word.

const BACK_TO_TODAY = 2*60*1000
const TABS = [['word', 'word'], ['in use', 'use'], ['did you know', 'dyk']]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']
function dayLabel(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '')
  if(!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

export default class WordWidget extends Widget {
  constructor() {
    super('word', 'Word of the Day')
    this.initState({ words: [] })

    // a ring open at the top for the title, as on Network
    this._ring = new ProgressCircle()
    this._ring.color = ACCENT
    this._ring.lineWidth = 2
    this._ring.rotation = 0.85
    this._ring.value = (2*Math.PI - 1.7) / (2*Math.PI)
    this.addChild(this._ring)

    const text = (fontSize, fill) => {
      const t = new PIXI.Text('', { fontFamily: 'ShareTechMono', fontSize, fill, align: 'center' })
      t.anchor.set(0.5)
      t.resolution = 2
      t.roundPixels = true
      this.addChild(t)
      return t
    }
    this._word = text(26, '#ffffff')
    this._pos = text(12, TEXT_GREY)

    this.main.title = 'Word of the Day'
    this.main.statusRightText = '< swipe: earlier words >'
    this._screens = TABS.map(([name, mode], i) => {
      const tab = this.main.getTabButton(i)
      tab.text = name
      tab.visible = true
      const screen = new WordScreen(mode)
      screen.on('swipe', (step) => this._select(this._index + step))
      this.main.getPage(i).addChild(screen)
      return screen
    })
    this._index = 0 // 0 = today's word
    this._indexAt = 0
  }

  msg2state(msg) {
    if(msg.error) return { error: msg.error }
    const words = Array.isArray(msg.words) ? msg.words.filter(w => w && w.word && w.definition) : []
    if(!words.length) return { error: 'No word of the day' }
    return { words, error: null }
  }

  updateState(obj) {
    super.updateState(obj)
    const today = this.state.words[0]
    if(!today) return
    // the circle: shrink a long word to fit
    this._word.text = today.word
    this._pos.text = today.partOfSpeech
    this._select(this._index)
  }

  // the word shown on the main screen; wraps round the feed's words
  _select(index) {
    const count = this.state.words.length
    if(!count) return
    this._index = Math.max(0, Math.min(count - 1, index))
    this._indexAt = Date.now()
    const w = this.state.words[this._index]
    this._screens.forEach(s => s.show(w))
    this.main.statusLeftText = this._index === 0 ? `today, ${dayLabel(w.day)}` : dayLabel(w.day)
  }

  render(renderer) {
    if(this._index && Date.now() - this._indexAt > BACK_TO_TODAY) this._select(0)
    const p = this.progress * this.dataLoadProgress
    this._ring.progress = p
    this._ring.size = this.size
    // the word at up to 26 px (large circle), no wider than the circle allows
    const maxWidth = 150*this.size
    this._word.style.fontSize = 26
    const natural = this._word.width / this._word.scale.x
    this._word.scale.set(Math.min(this.size, maxWidth / Math.max(1, natural)))
    this._word.alpha = p
    this._word.y = -6*this.size
    this._pos.alpha = p
    this._pos.y = 24*this.size
    this._pos.visible = this.size === 1
    this._screens.forEach(s => s.progress = this.main.progress * this.dataLoadProgress)
    super.render(renderer)
  }
}
