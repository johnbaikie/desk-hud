// Two Bambu Lab printers for the demo: an H2S part-way through a print with
// a full AMS 2 Pro, and an idle P1S with a single AMS.
export default class BambuDemoData {
  constructor() {
    this._start = Date.now() - 95*60*1000
  }

  get data() {
    const remaining = 72
    return {
      widgetId: 'bambu',
      payload: {
        printers: [
          {
            name: 'Workshop H2S', model: 'H2S', status: 'printing', error: null,
            stage: null, file: 'Desk cable tray v3', percent: 57,
            remainingMin: remaining, endTime: Date.now() + remaining*60*1000, startTime: this._start,
            layer: 142, totalLayers: 250, speed: 'standard',
            temps: { nozzles: [{ current: 220, target: 220 }], bed: { current: 65, target: 65 }, chamber: { current: 38, target: 0 } },
            ams: {
              humidity: ['21%'],
              slots: [
                { unit: 'A', slot: 1, type: 'PLA', color: 0x1a1a1a, empty: false, remain: 64, active: true },
                { unit: 'A', slot: 2, type: 'PLA', color: 0xf5f5f5, empty: false, remain: 90, active: false },
                { unit: 'A', slot: 3, type: 'PETG', color: 0xe8541c, empty: false, remain: 35, active: false },
                { unit: 'A', slot: 4, type: '', color: null, empty: true, remain: null, active: false },
              ],
            },
            problems: 0, updated: Date.now(),
          },
          {
            name: 'Office P1S', model: 'P1S', status: 'idle', error: null,
            stage: null, file: '', percent: 100, remainingMin: null, endTime: null, startTime: null,
            layer: 0, totalLayers: 0, speed: 'standard',
            temps: { nozzles: [{ current: 26, target: 0 }], bed: { current: 24, target: 0 }, chamber: null },
            ams: {
              humidity: ['34%'],
              slots: [
                { unit: 'A', slot: 1, type: 'PLA', color: 0x2f6fd6, empty: false, remain: 80, active: false },
                { unit: 'A', slot: 2, type: 'PLA-CF', color: 0x333333, empty: false, remain: 15, active: false },
                { unit: 'A', slot: 3, type: 'TPU', color: 0xd62f9a, empty: false, remain: 50, active: false },
                { unit: 'A', slot: 4, type: 'ABS', color: 0xeeeeee, empty: false, remain: 100, active: false },
              ],
            },
            problems: 0, updated: Date.now(),
          },
        ],
      },
    }
  }
}
