/** Formats for numbers and dates the interface shows. Pure (Intl does the localizing). */

/**
 * An instant as "23 nov 2026 · 20:32": day, short month, year and 24-hour time, in that
 * order in every language, so the time dock's date keeps its shape as it plays.
 * @param timeZone Defaults to the visitor's own.
 * @example formatInstant(Date.UTC(2026, 10, 23, 20, 32), 'es-AR', 'UTC') // '23 nov 2026 · 20:32'
 */
export function formatInstant(instantMs: number, locale: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone && { timeZone }),
  }).formatToParts(new Date(instantMs));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')} ${part('month').replace('.', '')} ${part('year')} · ${part('hour')}:${part('minute')}`;
}
