// Sample readings for the demo (written for it, in the style of the APIs')
export default class HoroscopeDemoData {
  get data() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const week = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
    return {
      widgetId: 'horoscope',
      payload: {
        sign: 'cancer',
        readings: {
          daily: {
            source: 'freeastroapi',
            date: day,
            text: 'Cancer, today is a good day to focus on your home and family life. You may find yourself thinking about ways to make your living space more comfortable and inviting. Spending time with loved ones can be especially rewarding now, and you may feel a strong desire to connect with them on a deeper level. It is also a good time to take care of the chores you have been putting off.',
            textSource: 'freehoroscopeapi',
            textDate: day,
            theme: 'Emotion',
            keywords: ['Intuition', 'Emotion', 'Nurturing'],
            scores: { overall: 58, love: 51, career: 50, money: 57, health: 72 },
            lucky: { color: 'Yellow', number: 52, start: new Date(day + 'T08:00:00Z').getTime(), end: new Date(day + 'T17:00:00Z').getTime() },
            moon: { sign: 'Sagittarius', phase: 'New Moon' },
          },
          weekly: { date: week, text: 'This week asks you to slow down and plan before you act. Early in the week a conversation clears up a misunderstanding that has been weighing on you. By midweek your energy turns to work, where steady progress beats a rush to finish. The weekend favours rest, good food and time with family; let someone else take the lead for once.' },
          monthly: { date: day.slice(0, 7), text: 'This month is likely to be a busy one, with much of your focus on work and daily routines. You may take on more responsibility or finally tackle projects that have waited a while, so make a plan and keep it simple. At home you may be thinking about improvements that would make your space more comfortable. Relationships with family and close friends stay a priority, and time with them will recharge you. It is a practical, down-to-earth month: balance your own needs with those of others and you will get a lot done.' },
        },
        errors: {},
        error: null,
      },
    }
  }
}
