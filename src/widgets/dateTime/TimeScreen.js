import WorldMapScreen from './WorldMapScreen.js'
import { ACCENT } from '../../frontend/theme.js'

// TIME tab: the world map with the sun and the configured time zones
export default class TimeScreen extends PIXI.Container {
  constructor() {
    super()
    this.progress = 0

    this._map = null
    // the map is built later (from server config), after rainbow mode has
    // moved ACCENT on to other widgets, so keep this widget's colour
    this._accent = ACCENT
  }

  // timezones: [{id, name, lat?, lon?}]; home: {lat, lon} or null
  setPlaces(timezones, home) {
    if(this._map) {
      this.removeChild(this._map)
      this._map.destroy({ children: true })
    }
    this._map = new WorldMapScreen(timezones, home, this._accent)
    this.addChild(this._map)
  }

  render(renderer) {
    if(this._map) {
      this._map.progress = this.progress
    }
    super.render(renderer)
  }
}
