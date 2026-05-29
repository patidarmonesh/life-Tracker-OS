import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth, subDays } from 'date-fns'

const FALLBACK_TIMEZONE = 'UTC'

export function normalizeTimezone(timezone) {
  const candidate = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return FALLBACK_TIMEZONE
  }
}

function getParts(date, timezone) {
  const normalizedTimezone = normalizeTimezone(timezone)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizedTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  }
}

export function toDateKey(date = new Date(), timezone) {
  const { year, month, day } = getParts(date, timezone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getTodayDateKey(timezone) {
  return toDateKey(new Date(), timezone)
}

export function parseDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`)
}

export function getRecentDateKeys(length, timezone, referenceDate = new Date()) {
  return Array.from({ length }, (_, i) => toDateKey(subDays(referenceDate, length - 1 - i), timezone))
}

export function getMonthDays(referenceDate = new Date(), timezone) {
  const { year, month } = getParts(referenceDate, timezone)
  const monthAnchor = new Date(year, month - 1, 1)
  const start = startOfMonth(monthAnchor)
  const end = endOfMonth(monthAnchor)

  return eachDayOfInterval({ start, end }).map(date => ({
    dateKey: format(date, 'yyyy-MM-dd'),
    dayLabel: format(date, 'd'),
    weekdayLabel: format(date, 'EEE'),
  }))
}

export function shiftMonth(referenceDate = new Date(), amount = 0, timezone) {
  const { year, month } = getParts(referenceDate, timezone)
  return addMonths(new Date(year, month - 1, 1), amount)
}

