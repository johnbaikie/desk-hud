// Accent colour for graphics (pointers, arcs, highlights, dots). It is read
// when the page loads: most widgets draw their accents into Graphics in their
// constructors, so the Accent widget saves a new setting here and reloads the
// page rather than redrawing everything.
//
// Rainbow mode gives every widget its own random accent. ACCENT is a live
// binding: index.js calls useWidgetAccent(i) before building widget i and
// useBaseAccent() afterwards, so anything a widget builds picks up its
// colour. Components that use the accent after construction keep a copy
// (`this._accent = ACCENT` in the constructor) instead of reading ACCENT later.
const ACCENT_KEY = 'DeskHud_accent'
const RAINBOW_KEY = 'DeskHud_rainbow'

export const DEFAULT_ACCENT = 0x00ff41 // Matrix green

function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch(e) {
    return null // storage blocked: use the defaults
  }
}

function writeStorage(key, value) {
  try {
    if(value === null) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
    return true
  } catch(e) {
    return false
  }
}

function loadAccent() {
  const saved = readStorage(ACCENT_KEY)
  return saved && /^[0-9a-f]{6}$/i.test(saved) ? parseInt(saved, 16) : DEFAULT_ACCENT
}

// fully saturated colour for a hue in [0, 1)
export function hueToColor(h) {
  const f = (n) => {
    const k = (n + h*6) % 6
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))))
  }
  return (f(5) << 16) | (f(3) << 8) | f(1)
}

// the colour picked in the Accent widget (also used outside the widgets in
// rainbow mode: sleep toggle, CPU thermometer)
export const BASE_ACCENT = loadAccent()
export const RAINBOW = readStorage(RAINBOW_KEY) === '1'

export let ACCENT = BASE_ACCENT

// random start hue each page load; golden-ratio steps keep neighbours apart
const rainbowStart = Math.random()

export function useWidgetAccent(index) {
  if(RAINBOW) {
    ACCENT = hueToColor((rainbowStart + index * 0.618034) % 1)
  }
}

export function useBaseAccent() {
  ACCENT = BASE_ACCENT
}

// picking a colour turns rainbow mode off
export function saveAccent(color) {
  return writeStorage(ACCENT_KEY, color.toString(16).padStart(6, '0'))
    && writeStorage(RAINBOW_KEY, null)
}

export function saveRainbow(on) {
  return writeStorage(RAINBOW_KEY, on ? '1' : null)
}
