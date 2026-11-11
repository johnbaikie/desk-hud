const Service = require('../../backend/services/Service.js')
const storage = require('node-persist')

// Merriam-Webster's Word of the Day from its public RSS feed (no key; the
// dictionary API has no word of the day). The feed holds the last 10 days;
// each item's description is HTML with the pronunciation, part of speech,
// definition, an example sentence, a quote from published writing and the
// "Did you know?" note, which this parses into plain text. The widget
// credits Merriam-Webster on screen. The last good list is kept in
// node-persist, so a failed fetch or a restart doesn't blank the widget.

const USER_AGENT = 'desk-hud (https://github.com/johnbaikie/desk-hud)'
const FEED = 'https://www.merriam-webster.com/wotd/feed/rss2'
const REFRESH = 60*60*1000 // the feed's own ttl
const RETRY = 10*60*1000
const REQUEST_TIMEOUT = 20*1000

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…' }
// numeric entities in the Windows-1252 range the feed uses (&#149; is a bullet)
const CP1252 = { 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•', 150: '–', 151: '—' }
function decode(text) {
  return text
    .replace(/&#(\d+);/g, (m, n) => CP1252[n] || String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}
const plain = (html) => decode(String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
  .replace(/\s+/g, ' ').trim()
const cdata = (xml, tag) => {
  const m = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`).exec(xml)
  return m ? (m[1] ?? m[2] ?? '') : ''
}
// the <p> paragraphs of a piece of HTML, as plain text
const paragraphs = (html) => [...String(html).matchAll(/<p>([\s\S]*?)<\/p>/gi)].map(m => plain(m[1])).filter(Boolean)

// one feed item -> {word, date, day (YYYY-MM-DD), pronunciation, partOfSpeech, definition, example, quote, source, didYouKnow}
function parseItem(xml) {
  const word = plain(cdata(xml, 'title'))
  const html = cdata(xml, 'description')
  const pubDate = cdata(xml, 'pubDate')
  const date = Date.parse(pubDate)
  // the word's own day, from the date as written ("Tue, 10 Nov 2026 00:00:01
  // -0500"): as a time it is the evening before in time zones west of New York
  const dm = /(\d{1,2}) ([A-Za-z]{3}) (\d{4})/.exec(pubDate)
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const month = dm ? MONTHS.indexOf(dm[2].toLowerCase()) : -1
  const day = month >= 0 ? `${dm[3]}-${String(month + 1).padStart(2, '0')}-${dm[1].padStart(2, '0')}` : ''
  if(!word || !html || !Number.isFinite(date) || !day) return null

  // "<strong>word</strong> &#149; \pro-NUN-ci-ation\&nbsp; &#149; <em>verb</em><br />"
  const head = /&#149;\s*\\([^\\]*)\\[\s\S]*?&#149;\s*<em>([^<]*)<\/em>/.exec(html)
  const parts = html.split(/<strong>\s*(?:Examples:|Did you know\?)\s*<\/strong>/i)
  // the definition block: paragraphs after the headword, up to "See the entry"
  const defBlock = (parts[0].split(/<br\s*\/?>/i).slice(1).join(' ') || parts[0])
  const defParas = paragraphs(defBlock).filter(p => !/^See the entry/i.test(p))
  const definition = defParas.filter(p => !p.startsWith('//')).join('\n')
  const example = defParas.filter(p => p.startsWith('//')).map(p => p.replace(/^\/\/\s*/, '')).join('\n')

  let quote = ''
  let source = ''
  const examplesHtml = /Examples:\s*<\/strong>([\s\S]*?)(?:<strong>\s*Did you know|$)/i.exec(html)
  if(examplesHtml) {
    const q = paragraphs(examplesHtml[1])[0] || ''
    // "“...” — Author, Publication, date"
    const m = /^(.*[”"])\s*[—–-]\s*(.+)$/.exec(q)
    quote = m ? m[1] : q
    source = m ? m[2] : ''
  }
  const dykHtml = /Did you know\?\s*<\/strong>([\s\S]*)$/i.exec(html)
  const didYouKnow = dykHtml ? paragraphs(dykHtml[1]).join('\n') : ''

  if(!definition) return null
  return {
    word,
    date,
    day,
    pronunciation: head ? decode(head[1]).trim() : '',
    partOfSpeech: head ? decode(head[2]).trim() : '',
    definition,
    example,
    quote,
    source,
    didYouKnow,
  }
}

class WordService extends Service {
  constructor(config, io, webApp) {
    super(config, io, webApp, 'word')
    this._words = []
    this._timer = null
  }

  async start() {
    try {
      const saved = await storage.getItem('word.items')
      if(Array.isArray(saved)) this._words = saved.filter(w => w && w.word && w.definition && w.day && Number.isFinite(w.date))
    } catch(err) {
      this.logger.error('Saved words:', err.message || err)
    }
    this._update() // not awaited: start() must resolve even if the feed hangs
  }

  async welcomeClient(socket) {
    if(this._words.length) this.emit(this._payload(), socket)
  }

  async onMessage() {}

  _payload() {
    return { words: this._words, error: null }
  }

  async _update() {
    clearTimeout(this._timer)
    let wait = REFRESH
    try {
      const response = await fetch(FEED, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      })
      if(!response.ok) throw new Error(`Merriam-Webster: HTTP ${response.status}`)
      const xml = await response.text()
      const words = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
        .map(m => parseItem(m[1]))
        .filter(Boolean)
        .sort((a, b) => b.date - a.date)
      if(!words.length) throw new Error('Merriam-Webster: no words in the feed')
      this._words = words
      await storage.setItem('word.items', words)
      this.emit(this._payload())
    } catch(err) {
      this.logger.error(err.message || err)
      wait = RETRY
      if(!this._words.length) this.emit({ error: String(err.message || err) })
    }
    this._timer = setTimeout(() => this._update(), wait)
  }
}

module.exports = WordService
module.exports.parseItem = parseItem
