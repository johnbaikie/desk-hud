// Accent colour for graphics (pointers, arcs, highlights, dots). It is read
// once when the page loads: most widgets draw their accents into Graphics in
// their constructors, so the Accent widget saves a new colour here and reloads
// the page rather than redrawing everything.
const STORAGE_KEY = 'DeskHud_accent'

export const DEFAULT_ACCENT = 0x00ff41 // Matrix green

function loadAccent() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if(saved && /^[0-9a-f]{6}$/i.test(saved)) return parseInt(saved, 16)
  } catch(e) {
    // storage blocked: fall back to the default
  }
  return DEFAULT_ACCENT
}

export const ACCENT = loadAccent()

export function saveAccent(color) {
  try {
    window.localStorage.setItem(STORAGE_KEY, color.toString(16).padStart(6, '0'))
    return true
  } catch(e) {
    return false
  }
}
