const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Learning cards due within this window are shown early when nothing else is due (Anki's "learn ahead"). */
export const LEARN_AHEAD_MS = 20 * MINUTE

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function timeZoneOffset(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const wallClockAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  )
  return wallClockAsUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** The study day runs from local midnight to local midnight in the configured time zone. */
export function studyDayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const offset = timeZoneOffset(now, timeZone)
  const local = new Date(now.getTime() + offset)
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  const start = new Date(localMidnight - timeZoneOffset(new Date(localMidnight - offset), timeZone))
  const nextMidnight = localMidnight + DAY
  const end = new Date(nextMidnight - timeZoneOffset(new Date(nextMidnight - offset), timeZone))
  return { start, end }
}

/** Compact interval label for rating buttons, e.g. "1m", "10m", "3h", "4d", "2.1mo", "1.3y". */
export function formatInterval(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))}m`
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`
  const days = ms / DAY
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${trim(days / 30)}mo`
  return `${trim(days / 365)}y`
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "")
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return true
  } catch {
    return false
  }
}
