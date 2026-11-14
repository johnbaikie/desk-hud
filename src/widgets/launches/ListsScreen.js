import { ACCENT } from '../../frontend/theme.js'
import TextField from '../../frontend/components/TextField'
import ListScreen from './ListScreen.js'

// The LAUNCHES tab: the UPCOMING or RECENT list (ListScreen), picked with
// two pill buttons at the bottom left. Re-emits the lists' 'select'.

const PILLS = [['upcoming', 'upcoming'], ['recent', 'recent']]
const PILL_WIDTH = 74

export default class ListsScreen extends PIXI.Container {
  constructor() {
    super()
    this._accent = ACCENT
    this.progress = 0
    this._lists = {}
    for(const [mode] of PILLS) {
      const list = new ListScreen(mode)
      list.on('select', (id) => this.emit('select', id))
      this._lists[mode] = list
      this.addChild(list)
    }
    this._pills = PILLS.map(([mode, label], i) => {
      const pill = new PIXI.Container()
      pill.frame = new PIXI.Graphics()
      pill.addChild(pill.frame)
      pill.label = new TextField(label, { fontFamily: 'ShareTechMono', fontSize: 10, fill: '#ffffff', strokeThickness: 0 })
      pill.label.anchor.set(0.5)
      pill.addChild(pill.label)
      pill.x = -282 + PILL_WIDTH/2 + i*(PILL_WIDTH + 6)
      pill.y = 90
      pill.interactive = true
      pill.cursor = 'pointer'
      pill.hitArea = new PIXI.Rectangle(-PILL_WIDTH/2 - 2, -13, PILL_WIDTH + 4, 26)
      pill.on('pointertap', () => this.mode = mode)
      pill.mode = mode
      this.addChild(pill)
      return pill
    })
    this.mode = 'upcoming'
  }

  set mode(mode) {
    this._mode = mode
    for(const [m, list] of Object.entries(this._lists)) list.visible = m === mode
    this._pills.forEach(pill => {
      const selected = pill.mode === mode
      pill.frame.clear()
      pill.frame.lineStyle({ width: 1, color: selected ? this._accent : 0xffffff, alpha: selected ? 1 : 0.6 })
      pill.frame.beginFill(selected ? this._accent : 0x000000, selected ? 0.35 : 0.01)
      pill.frame.drawRoundedRect(-PILL_WIDTH/2, -9, PILL_WIDTH, 18, 9)
      pill.frame.endFill()
    })
  }

  get mode() {
    return this._mode
  }

  show(upcoming, recent) {
    this._lists.upcoming.show(upcoming)
    this._lists.recent.show(recent)
  }

  render(renderer) {
    for(const list of Object.values(this._lists)) list.progress = this.progress
    this._pills.forEach(p => { p.frame.alpha = this.progress; p.label.progress = this.progress; p.interactive = this.progress > 0.5 })
    super.render(renderer)
  }
}
