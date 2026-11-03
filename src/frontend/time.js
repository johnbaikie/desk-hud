const DAY = 24*60*60*1000

// Local midnight of the day containing `time` (ms). Don't derive this from
// Math.floor(time/DAY), which gives UTC days and puts the evening (after
// 6 PM in Chicago) on the next day.
export function startOfDay(time = Date.now()) {
  const d = new Date(time)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Whole local days from `time` to today (0 = today, 1 = yesterday, ...);
// rounding absorbs the 23/25-hour days around DST changes.
export function daysAgo(time, now = Date.now()) {
  return Math.round((startOfDay(now) - startOfDay(time)) / DAY)
}
