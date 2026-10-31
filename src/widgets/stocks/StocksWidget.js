import Widget from '../../frontend/Widget.js'
import Icon from '../../frontend/components/Icon.js'
import TextField from '../../frontend/components/TextField.js'
import ScaleCircle from '../../frontend/circles/ScaleCircle.js'
import StocksHistoryScreen from './StocksHistoryScreen.js'

// with several symbols the widget shows one at a time, switching on this period
const ROTATE_INTERVAL = 20*60*1000

export default class StocksWidget extends Widget {
  constructor() {
    super('stocks', "Stocks")
    this.initState({
      stocks: [],
    })

    this.main.title = "Stock Market"
    this._historyScreen = new StocksHistoryScreen()
    this.main.getPage(0).addChild(this._historyScreen)

    this._trendIcon = new Icon()
    this.addChild(this._trendIcon)

    this._symbolLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 25,
      fill: '#ffffff',
      align: 'center',
    })
    this.addChild(this._symbolLabel)

    this._priceLabel = new TextField('', {
      fontFamily: 'ShareTechMono',
      fontSize: 18,
      fill: '#ffffff',
      align: 'center',
      stroke: "#ffffff",
      strokeThickness: 0.5,
    })
    this.addChild(this._priceLabel)

    this.changeScale = new ScaleCircle(-10, 10, '%', 11, Math.PI*1.5)
    this.changeScale.rotation = 0.25*Math.PI
    this.addChild(this.changeScale)
  }

  msg2state(msg) {
    if(msg.error) {
      return {error: msg.error}
    }
    const stocks = (Array.isArray(msg.stocks) ? msg.stocks : [])
      .filter(s => s && s.symbol && Number.isFinite(s.price))
      .map(s => ({
        symbol: s.symbol,
        current: s.price,
        change: s.dayOpen ? Number((s.price/s.dayOpen-1).toFixed(3)) : 0,
        history: Array.isArray(s.history) ? s.history : [],
      }))
    if(!stocks.length) {
      return {error: 'No stock data available'}
    }
    return {stocks, error: null}
  }

  // the stock shown now; the same for the circle and the history screen
  get _stock() {
    const stocks = this.state.stocks
    if(!stocks.length) {
      return {symbol: '', current: null, change: 0, history: []}
    }
    return stocks[Math.floor(Date.now()/ROTATE_INTERVAL) % stocks.length]
  }

  render(renderer) {
    const stock = this._stock
    if(stock.change > 0) {
      this._trendIcon.code = 0xe5d8
      this._trendIcon.color = 0xffffff
    } else if(stock.change < 0) {
      this._trendIcon.code = 0xe5db
      this._trendIcon.color = 0x00d8ff
    } else {
      this._trendIcon.code = 0xe15b
      this._trendIcon.color = 0xffffff
    }

    this._trendIcon.scale.set(this.size)
    this._trendIcon.alpha = this.progress
    this._symbolLabel.progress = this.progress * this.dataLoadProgress
    this._symbolLabel.text = stock.symbol.toLowerCase()
    this._symbolLabel.style.fontSize = 7 + 11*this.size
    if(stock.current) {
      this._priceLabel.text = stock.current.toFixed(2)
    }
    this._symbolLabel.y = -50*this.size
    this._priceLabel.progress = this.progress * this.dataLoadProgress
    this._priceLabel.y = 50*this.size
    this._priceLabel.style.fontSize = 7 + 8*this.size
    this.changeScale.progress = this.progress
    this.changeScale.size = this.size
    this.changeScale.value = 100*stock.change
    this.changeScale.valueMin = 0
    this.changeScale.valueMax = 0
    if(stock.change > 0) {
      this.changeScale.valueMax = 100*stock.change
    } else {
      this.changeScale.valueMin = 100*stock.change
    }
    this.changeScale.visible = this.size == 1
    this._historyScreen.progress = this.main.progress * this.dataLoadProgress
    this._historyScreen.symbol = stock.symbol
    this._historyScreen.data = stock.history
    this.main.title = stock.symbol ? `Stock Market: ${stock.symbol}` : 'Stock Market'
    super.render(renderer)
  }
}