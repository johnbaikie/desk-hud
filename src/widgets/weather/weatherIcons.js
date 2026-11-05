// Weather-font glyphs ('weathericons-regular-webfont') for OpenWeatherMap-style
// icon codes; WeatherService maps NWS icons onto these codes.
export const ICONS = {
  '01d': '',    '01n': '',
  '02d': '',    '02n': '',
  '03d': '',    '03n': '',
  '04d': '',    '04n': '',
  '09d': '',    '09n': '',
  '10d': '',    '10n': '',
  '11d': '',    '11n': '',
  '13d': '',    '13n': '',
  '50d': '',    '50n': '',
}

export const WEATHER_FONT = 'weathericons-regular-webfont'

// Colours for the glyphs. Each glyph is one character, so:
// - cloud + rain/bolt/snow icons use hard-edged vertical bands (the cloud
//   sits above the precipitation), as fractions of the text's height;
// - sun/moon + cloud icons are drawn twice: the whole icon in the sun or
//   moon colour, then the font's plain cloud glyph on top in white. The font draws those clouds at the same origin, so
//   they cover the composite's cloud exactly and only the sun/moon shows.
const SUN = '#ffd54f'
const MOON = '#dbe4ff'
const CLOUD = '#ffffff'
const RAIN = '#4fc3f7'
const BOLT = '#ffe03a'
const SNOW = '#a6dcff'
const FOG = '#b0bec5'

const CLOUD_GLYPH = '\uf041' // the font's plain cloud
const RAIN_BANDS = [[CLOUD, 0.6], [RAIN, 1]]

export const ICON_COLORS = {
  '01d': { bands: [[SUN, 1]] },
  '01n': { bands: [[MOON, 1]] },
  '02d': { bands: [[SUN, 1]], overlay: CLOUD_GLYPH, overlayBands: [[CLOUD, 1]] },
  '02n': { bands: [[MOON, 1]], overlay: CLOUD_GLYPH, overlayBands: [[CLOUD, 1]] },
  '03d': { bands: [[CLOUD, 1]] }, '03n': { bands: [[CLOUD, 1]] },
  '04d': { bands: [[CLOUD, 1]] }, '04n': { bands: [[CLOUD, 1]] },
  // the showers glyph's drops sit elsewhere, so colour the drops on the
  // composite itself (bottom band) and lay only the plain cloud on top
  '09d': { bands: [[SUN, 0.6], [RAIN, 1]], overlay: CLOUD_GLYPH, overlayBands: [[CLOUD, 1]] },
  '09n': { bands: [[MOON, 0.6], [RAIN, 1]], overlay: CLOUD_GLYPH, overlayBands: [[CLOUD, 1]] },
  '10d': { bands: RAIN_BANDS }, '10n': { bands: RAIN_BANDS },
  '11d': { bands: [[CLOUD, 0.6], [BOLT, 1]] }, '11n': { bands: [[CLOUD, 0.6], [BOLT, 1]] },
  '13d': { bands: [[CLOUD, 0.6], [SNOW, 1]] }, '13n': { bands: [[CLOUD, 0.6], [SNOW, 1]] },
  '50d': { bands: [[FOG, 1]] }, '50n': { bands: [[FOG, 1]] },
}

// PIXI.TextStyle fill fields for a list of [colour, end] bands
export function bandFill(bands) {
  const fill = []
  const fillGradientStops = []
  let start = 0
  for(const [color, end] of bands) {
    fill.push(color, color)
    fillGradientStops.push(start, end)
    start = end
  }
  return { fill, fillGradientStops, fillGradientType: 0 } // 0 = PIXI.TEXT_GRADIENT.LINEAR_VERTICAL
}
