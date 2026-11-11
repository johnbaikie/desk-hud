import TextField, { TEXT_GREY } from '../../frontend/components/TextField'

// One tab of the Word of the Day widget, for the word being shown:
// - 'word': the definition and Merriam-Webster's example sentence
// - 'use': a quote using the word, with its source
// - 'dyk': the "Did you know?" note
// The word (with pronunciation and part of speech) heads each tab. Text is
// plain PIXI.Text in mixed case (TextField would capitalise it), sized 15
// down to 10 to fit. Swiping left or right emits 'swipe' (+1 = an older word).

const LEFT = -280
const WIDTH = 560
const TOP = -60
const BOTTOM = 80
const SWIPE_DISTANCE = 30

const textStyle = (fill) => ({
  fontFamily: 'ShareTechMono', fontSize: 14, fill, wordWrap: true, wordWrapWidth: WIDTH, lineHeight: 19,
})
const crisp = (text) => {
  text.resolution = window.devicePixelRatio || 1
  text.roundPixels = true
  return text
}

export default class WordScreen extends PIXI.Container {
  constructor(mode) {
    super()
    this._mode = mode
    this.progress = 0
    this._word = undefined

    // swipe area under everything else
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

    this._head = crisp(new PIXI.Text('', { fontFamily: 'ShareTechMono', fontSize: 24, fill: '#ffffff' }))
    this._head.anchor.set(0, 0.5)
    this._head.x = LEFT
    this._head.y = -80
    this.addChild(this._head)
    this._sub = crisp(new PIXI.Text('', { fontFamily: 'ShareTechMono', fontSize: 13, fill: TEXT_GREY }))
    this._sub.anchor.set(0, 0.5)
    this._sub.y = -78
    this.addChild(this._sub)

    this._main = crisp(new PIXI.Text('', textStyle('#ffffff')))
    this._main.x = LEFT
    this._main.y = TOP
    this.addChild(this._main)
    this._extra = crisp(new PIXI.Text('', textStyle(TEXT_GREY)))
    this._extra.x = LEFT
    this.addChild(this._extra)

    this._credit = new TextField("Merriam-Webster's Word of the Day", {
      fontFamily: 'ShareTechMono', fontSize: 10, fill: TEXT_GREY, strokeThickness: 0,
    })
    this._credit.anchor.set(1, 0.5)
    this._credit.x = LEFT + WIDTH
    this._credit.y = 89
    this.addChild(this._credit)
  }

  _endDrag(x) {
    if(this._dragStartX === null || this._dragStartX === undefined) return
    const dx = x - this._dragStartX
    this._dragStartX = null
    if(Math.abs(dx) >= SWIPE_DISTANCE) this.emit('swipe', dx < 0 ? -1 : 1)
  }

  // w: a word from WordService, or null
  show(w) {
    if(w === this._word) return
    this._word = w
    if(!w) {
      this._head.text = ''
      this._sub.text = ''
      this._place('', '')
      return
    }
    this._head.text = w.word
    this._sub.text = [w.pronunciation && `\\${w.pronunciation}\\`, w.partOfSpeech].filter(Boolean).join('   ')
    this._sub.x = LEFT + this._head.width + 14
    if(this._mode === 'word') {
      this._place(w.definition, w.example ? `// ${w.example}` : '')
    } else if(this._mode === 'use') {
      this._place(w.quote || 'No quote for this word.', w.source ? `— ${w.source}` : '')
    } else {
      this._place(w.didYouKnow || 'No note for this word.', '')
    }
  }

  // the main text and a grey line under it, at the largest size that fits
  _place(main, extra) {
    for(let size = 15; size >= 10; size--) {
      for(const t of [this._main, this._extra]) {
        t.style.fontSize = size
        t.style.lineHeight = Math.round(size * 1.35)
      }
      const h1 = main ? PIXI.TextMetrics.measureText(main, this._main.style).height : 0
      const h2 = extra ? PIXI.TextMetrics.measureText(extra, this._extra.style).height + size*0.6 : 0
      if(h1 + h2 <= BOTTOM - TOP) break
    }
    this._main.text = main
    this._extra.text = extra
    this._extra.y = TOP + (main ? PIXI.TextMetrics.measureText(main, this._main.style).height : 0) + this._main.style.fontSize*0.6
  }

  render(renderer) {
    for(const t of [this._head, this._sub, this._main, this._extra]) t.alpha = this.progress
    this._credit.progress = this.progress
    this._swipe.visible = this.progress > 0.5
    super.render(renderer)
  }
}
