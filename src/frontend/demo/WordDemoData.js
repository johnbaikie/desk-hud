// Three Words of the Day from Merriam-Webster's feed (Nov 2026), for the demo,
// dated today and the two days before.
const WORDS = [
  {
    word: "defer",
    pronunciation: "dih-FER",
    partOfSpeech: "verb",
    definition: "To defer something is to put it off or delay it, to choose to do it at a later time.",
    example: "We decided to defer the offer so that we could explore other options.",
    quote: "“Amelie plans to defer college for a year to attempt a mostly solo thru-hike of the 2,650-mile Pacific Crest Trail.”",
    source: "Justin Souza, Noozhawk (Santa Barbara, California), 24 Sept. 2026",
    didYouKnow: "There are two distinct words spelled defer in English, each with its own history and meaning. The defer having to do with allowing someone else to decide or choose something, or with agreeing to follow someone else’s decision, tradition, etc., (as in “deferred to his parents’ wishes”) comes from the Latin dēferre, meaning “to bring down, convey, transfer, submit.” The defer meaning “to put off or delay” comes from a different Latin verb, differre, which itself has several meanings, including two that resound in its English descendant: “to postpone” and “to delay.” Another meaning of differre is “to be unlike or distinct,” which makes apparent another of its descendants: differ, meaning “to be different.”",
    daysAgo: 0
  },
  {
    word: "wabi-sabi",
    pronunciation: "WAH-bee-SAH-bee",
    partOfSpeech: "noun",
    definition: "Wabi-sabi refers to a philosophy of Japanese origin that emphasizes the aesthetic value in imperfect, impermanent, and simple things. This word can also refer to the qualities of imperfection, impermanence, and simplicity considered as beautiful.",
    example: "Over the years, the gardener learned to let go of his perfectionism and embrace wabi-sabi.",
    quote: "\"Traditional Japanese homes often follow the philosophy of wabi-sabi, an appreciation for imperfection and asymmetry. If elements are flawed, worn out or unbalanced, rather than scrambling to fix them, the theory goes, it's better to not only accept but celebrate a place's peccadillos.\"",
    source: "Robin Roberts, The Vancouver (British Columbia) Sun, 9 May 2026",
    didYouKnow: "Wabi-sabi followed a simple path to English: it was borrowed directly from Japanese in the early 1960s. The philosophy this word refers to, however, is much older. In the mid-16th century, Japanese tea master Sen Rikyū firmly established simple or unadorned beauty, known as wabi, and an aged appearance or rustic patina, known as sabi, as integral aesthetic elements of the ceramics used in tea ceremonies. A popular expression of wabi-sabi is seen in kintsugi, the traditional Japanese art of repairing broken pottery using a lacquer and metal powder (such as gold, silver, or platinum) to draw attention to, rather than hide, the repair. Kintsugi is another Japanese borrowing, from kin, meaning \"gold\" and tsugi, meaning \"patch.\"",
    daysAgo: 1
  },
  {
    word: "cockamamie",
    pronunciation: "kah-kuh-MAY-mee",
    partOfSpeech: "adjective",
    definition: "Cockamamie describes something that is ridiculous, silly, or incredible.",
    example: "Instead of being honest, he came up with a cockamamie excuse about why he didn’t turn in his assignment.",
    quote: "“As my wife and I plotted our annual family road trip, I made my pitch: A cemetery tour of the Midwest! It would be fun! … ‘It’s cemetery summer,’ I whispered and pumped my fist. A few days after my wife agreed to the plan, I found an even more willing audience for my cockamamie scheme.”",
    source: "Will McGrath, The New York Times, 20 Aug. 2026",
    didYouKnow: "By the look and sound of it, cockamamie (also spelled cockamamy) could have something to do with a rooster and the outrageous sound it makes. But in fact, cockamamie is believed to be an altered form of the term decalcomania, which refers to the process, invented in the mid-19th century, of transferring pictures and designs from specially prepared paper to surfaces such as glass or porcelain. (The word referring to the picture or design itself, decal, is a shortening of decalcomania.) The word decalcomania comes from French, with décalcomanie combining the verb décalquer, meaning “to trace\" or \"to transfer by tracing,” and -manie, meaning “-mania.” Starting in the 1930s, painted strips of paper with images capable of being transferred to the skin were called decals or—in children’s slang—cockamamies. Those familiar with today’s temporary tattoos will understand quickly that these were regarded by many as silly novelties, lending the word cockamamie the necessary leeway for application to anything ridiculous.",
    daysAgo: 2
  }
]

export default class WordDemoData {
  get data() {
    const pad = (n) => String(n).padStart(2, "0")
    const words = WORDS.map(({ daysAgo, ...w }) => {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      d.setHours(0, 0, 0, 0)
      return { ...w, date: d.getTime(), day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
    })
    return { widgetId: "word", payload: { words, error: null } }
  }
}
