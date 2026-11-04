import TimezonePreview from "./TimezonePreview"
import { ACCENT } from '../../frontend/theme.js'

export default class TimeScreen extends PIXI.Container {
  constructor() {
    super()
    this.progress = 0

    this._timezonePreview = null
    // previews are added later (from server config), after rainbow mode has
    // moved ACCENT on to other widgets, so keep this widget's colour
    this._accent = ACCENT
  }

  addTimezonePreview(timezones) {
    if(this._timezonePreview) {
      this.removeChild(this._timezonePreview)
    }
    this._timezonePreview = new TimezonePreview(timezones, this._accent)
    this._timezonePreview.x = -280
    this._timezonePreview.y = -65
    this.addChild(this._timezonePreview)
  }

  render(renderer) {
    if(this._timezonePreview) {
      this._timezonePreview.progress = this.progress
    }
    super.render(renderer)
  }
}