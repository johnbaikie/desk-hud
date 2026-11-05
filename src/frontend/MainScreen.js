import ErrorScreen from './ErrorScreen.js'
import DiamondButton from './components/DiamondButton.js'
import LineArt from './components/LineArt.js'
import TextField, { TEXT_DIM } from './components/TextField.js'

export default class MainScreen extends PIXI.Container {

  constructor() {
    super()
    this._error - null
    this.progress = 0
    this.statusLeftText = null
    this.statusRightText = null

    // a rounded panel with a short bar under the title; the line out to
    // the right links the panel to the large widget circles
    this._frame = new LineArt()
    this._frame.addRoundedSequence([
      0, -97,
      295, -97,
      295, 108,
      -295, 108,
      -295, -97,
      0, -97,
    ], 16, 1, 0xffffff, 0.55)
    this._frame.addLine(-70, -97, 70, -97, 3, 0xffffff, 1, 0.3, 1)
    this._frame.addLine(295, 0, 355, 0, 1, 0xffffff, 0.55, 0, 0.5)

    this.addChild(this._frame)

    this._errorScreen = new ErrorScreen()
    this.addChild(this._errorScreen )

    this._titleLabel = new TextField('>> widget <<', {
      fontFamily: 'ShareTechMono',
      fontSize:11,
      fill: '#ffffff',
      stroke: "#ffffff",
      strokeThickness: 1.5,
      align: 'center',
    });
    this._titleLabel.y = -111
    this.addChild(this._titleLabel)
    
    this._statusLeftLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 10,
      fill: TEXT_DIM, // solid grey: faded white looks blurry
      strokeThickness: 0,
      align: 'center',
    });
    this._statusLeftLabel.x = -210
    this._statusLeftLabel.y = -111
    this.addChild(this._statusLeftLabel)

    this._statusRightLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 10,
      fill: TEXT_DIM, // solid grey: faded white looks blurry
      strokeThickness: 0,
      align: 'center',
    });
    this._statusRightLabel.x = 210
    this._statusRightLabel.y = -111
    this.addChild(this._statusRightLabel)

    this._tabButtons = [];
    // one row of pill buttons under the panel, first tab on the right
    ;[200, 75, -50].forEach((x, i) => {
      this._tabButtons[i] = new DiamondButton()
      this._tabButtons[i].x = x
      this._tabButtons[i].y = 130
    })
    this._tabButtons.forEach((button, i) => {
      this.addChild(button)
      button.on('activate', () => this.activateTab(i))
      button.visible = false
    })
    
    this._pages = [
      new PIXI.Container(),
      new PIXI.Container(),
      new PIXI.Container(),
    ]
    this._pages.forEach(p => p.y = 10)
    this._page = null
    this.activateTab(0)
  }

  setCustomErrorScreen(screen) {
    this.removeChild(this._errorScreen)
    this._errorScreen = screen
    this.addChild(this._errorScreen)
  }

  get error() {
    return this._error
  }

  set error(v) {
    this._error = v
    this._errorScreen.message = v
  }

  activateTab(index) {
    this._tabButtons.forEach((t, i) => t.active = (i === index))
    if(this._page) {
      this.removeChild(this._page)
    }
    this._page = this._pages[index]
    this.addChildAt(this._page, 0)
  }

  getPage(i) {
    return this._pages[i]
  }

  getTabButton(i) {
    return this._tabButtons[i]
  }

  get title() {
    return this._titleLabel.text
  }

  set title(v) {
    this._titleLabel.text = v
  }

  render(renderer) {
    super.render(renderer)

    this._frame.progress = this.progress
    this._titleLabel.progress = Math.max(0, 2*this.progress - 0.5)
    this._statusLeftLabel.progress = this.progress
    this._statusRightLabel.progress = this.progress

    this._statusLeftLabel.text = this.statusLeftText || ''
    this._statusRightLabel.text = this.statusRightText || ''

    this._tabButtons.forEach(t => {
      t.progress = this.progress
    })

    this._pages.forEach(p => {
      p.visible = !this.error
    })
    this._errorScreen.progress = this.progress
    this._errorScreen.visible = this.error
    
  }

}