import Widget from '../../frontend/Widget.js'

// Placeholder with no data or service. Keeps a seventh widget in the list
// (which also brings back the rotation arrows); used to test touch input.
export default class BlankWidget extends Widget {
  constructor() {
    super('blank', 'Blank')
    this.initState({})
    this.updateState({}) // nothing to wait for: mark as loaded
    this.main.title = 'Blank'
  }
}
