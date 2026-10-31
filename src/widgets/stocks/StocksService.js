const Service = require("../../backend/services/Service");
const fetch = require('node-fetch');
const storage = require('node-persist');

// StockData's free plan allows ~100 requests a day. Quotes for all symbols
// take one request; daily history takes one request per symbol.
const QUOTES_INTERVAL = 20*60*1000
const DAILY_INTERVAL = 6*60*60*1000

class StocksService extends Service {

  constructor(config, io, webApp) {
    super(config, io, webApp, 'stocks')
    this._loop1 = null
    this._loop2 = null
    this._quotes = null // {updated, bySymbol: {IBM: {price, dayOpen}}}
    this._daily = null  // {updated, bySymbol: {IBM: [{date, close}]}}
  }

  // stockdata.symbol may be "IBM", "ORCL,IBM" or ["ORCL", "IBM"]
  _getSymbols() {
    const value = this.config.getProp('stockdata.symbol')
    const list = Array.isArray(value) ? value : String(value).split(',')
    return [...new Set(list.map(s => String(s).trim().toUpperCase()).filter(s => s))]
  }

  // cached data is reused only if it covers every configured symbol
  _covers(cache, symbols) {
    return !!cache && !!cache.bySymbol && symbols.every(s => cache.bySymbol[s])
  }

  async start() {
    const symbols = this._getSymbols()
    const quotes = await storage.getItem('stocks.v2.quotes')
    const daily = await storage.getItem('stocks.v2.daily')
    this._quotes = this._covers(quotes, symbols) ? quotes : null
    this._daily = this._covers(daily, symbols) ? daily : null

    if(this._loop1) {
      clearInterval(this._loop1)
    }
    if(this._loop2) {
      clearInterval(this._loop2)
    }
    this._loop1 = setInterval(() => this.updateQuotes(), QUOTES_INTERVAL)
    this._loop2 = setInterval(() => this.updateDaily(), DAILY_INTERVAL)

    // after a restart, only refetch what is missing or stale
    const now = Date.now()
    if(!this._quotes || now - this._quotes.updated > QUOTES_INTERVAL) {
      await this.updateQuotes()
    }
    if(!this._daily || now - this._daily.updated > DAILY_INTERVAL) {
      setTimeout(async () => await this.updateDaily(), 1000)
    }
  }

  _createMessage() {
    if(!this._quotes || !this._daily) {
      this.logger.log('Unable to create full stocks message', {quotes: !!this._quotes, daily: !!this._daily})
      return null
    }
    const stocks = this._getSymbols()
      .filter(symbol => this._quotes.bySymbol[symbol])
      .map(symbol => ({
        symbol,
        price: this._quotes.bySymbol[symbol].price,
        dayOpen: this._quotes.bySymbol[symbol].dayOpen,
        // oldest first, for the chart
        history: (this._daily.bySymbol[symbol] || []).map(d => d.close).reverse(),
      }))
    return {stocks, error: null}
  }

  async welcomeClient(socket) {
    const msg = this._createMessage()
    if(msg) {
      this.emit(msg, socket)
    }
  }

  _emitUpdate() {
    const msg = this._createMessage()
    if(msg) {
      this.emit(msg)
    }
  }

  async updateQuotes() {
    try {
      const apiKey = this.config.getProp('stockdata.apiKey')
      const symbols = this._getSymbols()
      const json = await this._request('quote', apiKey, symbols.join(','))
      const bySymbol = {}
      for(const q of json.data) {
        if(q.ticker && Number.isFinite(q.price)) {
          bySymbol[q.ticker.toUpperCase()] = {price: q.price, dayOpen: q.day_open}
        }
      }
      if(!Object.keys(bySymbol).length) throw new Error('No stock prices returned')
      this._quotes = {updated: Date.now(), bySymbol}
      await storage.setItem('stocks.v2.quotes', this._quotes)
      this._emitUpdate()
    } catch(err) {
      this.logger.error(err)
      this.emit({error: String(err.message || err)})
    }
  }

  async updateDaily() {
    try {
      const apiKey = this.config.getProp('stockdata.apiKey')
      const bySymbol = {}
      // the eod endpoint does not label rows by ticker, so ask one symbol at a time
      for(const symbol of this._getSymbols()) {
        const json = await this._request('eod', apiKey, symbol)
        bySymbol[symbol] = json.data.map(d => ({date: d.date, close: d.close}))
      }
      this._daily = {updated: Date.now(), bySymbol}
      await storage.setItem('stocks.v2.daily', this._daily)
      this._emitUpdate()
    } catch(err) {
      this.logger.error(err)
      this.emit({error: String(err.message || err)})
    }
  }

  async _request(endpoint, apiKey, symbols) {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0
    const url = `https://api.stockdata.org/v1/data/${endpoint}?symbols=${encodeURIComponent(symbols)}&api_token=${apiKey}`
    this.logger.log(`call https://api.stockdata.org/v1/data/${endpoint}?symbols=${symbols}&api_token=${apiKey.substr(0, 2)}...`)
    const response = await fetch(url)
    this.logger.debug(`${endpoint} Response received`, {ok: response.ok})
    const json = await response.json()
    if(json.Note) throw new Error(json.Note)
    if(!json || !Array.isArray(json.data) || !json.data.length) {
      throw new Error(json.error?.message || `No stock data returned for ${symbols}`)
    }
    return json
  }

}

module.exports = StocksService
