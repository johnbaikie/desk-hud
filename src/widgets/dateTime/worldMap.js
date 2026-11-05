// Land mask for the TIME screen's dot map: an equirectangular grid of
// COLS x ROWS cells from LAT_TOP to LAT_BOTTOM, one bit per cell (1 = land),
// row by row, packed into bytes (most significant bit first) and base64'd.
// Generated from Natural Earth 110m land (public domain, via the
// world-atlas npm package) by sampling each cell's centre.
export const COLS = 130
export const ROWS = 47
export const LAT_TOP = 75
export const LAT_BOTTOM = -56

const LAND_BITS = 'AAAOB0gH/8AAAAQD//AIAABwAPjfwf/gAAwDG/////AH///////////gGgAAAAAAAn//////////4QgAAAAAAAAH////AIHAAB5/////////wHj//4HQAAAHx///////5AAEB//4fgAAEOf//////gcAAAD//7/AAAo////////hgAAAH///8AAA////////+AAAAAH///MAAH////////4AAAAA///+AAAH/1z////+AAAAAD//+AAADxeDP////iAAAAAP//wAAAOL3+////YAAAAAAf/+AAAAwAf7///+RAAAAAB//4AAAB+AP////wYAAAAAB//AAAAP+x/////gAAAAAAD+EAAAB///3///+AAAAAAALwQAAAP//vj///wAAAAAAAPAAAAB///fw//+gAAAAgAAcxAAAH//9/B8/AAAAAAAAA+AAAAf//74Hh4AAAAAAAAAeAAAB///+AMDwgAAAAAAAAIAAAH///gAwDAAAAAAAAAAD4AAP///gBAAEAAAAAAAAAfwAAf//+AABAAAAAAAAAAB/4AAA//wAAMMAAAAAAAAAP/gAAD/+AAATwAAAAAAAAA//gAAP/wAABmgAAAAAAAAD//gAAf+AAACADgAAAAAAAP//AAA/4AAAHAHAAAAAAAAf/8AAD/gAAAAgCAAAAAAAB//gAAP/AAAAAMgAAAAAAAD/+AAB/8gAAADyAAAAAAAAD/4AAH/GAAAAf8AAAAAAAAP/AAAP8QAAAH/4AAAAAAAA/wAAA/xAAAA//wAAAAAAAH+AAAD+AAAAD//AAAAAAAAf4AAAHwAAAAH/8AAAAAAAB/AAAAOAAAAAcfwAAAAAAAHwAAAAAAAAAAA+AQAAAAAA/AAAAAAAAAAAAwAgAAAAAD4AAAAAAAAAAAAACAAAAAAGAAAAAAAAAAAAAAgAAAAAA4AAAAAAAAAAAAAEAAAAAADgAAAAAAAAAAAAAAAAAAAAMQAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAA='

const bytes = Uint8Array.from(atob(LAND_BITS), c => c.charCodeAt(0))

export function isLand(col, row) {
  const i = row * COLS + col
  return (bytes[i >> 3] & (0x80 >> (i & 7))) !== 0
}

// centre of a cell in degrees
export function cellLonLat(col, row) {
  return [
    -180 + (col + 0.5) * 360 / COLS,
    LAT_TOP - (row + 0.5) * (LAT_TOP - LAT_BOTTOM) / ROWS,
  ]
}
