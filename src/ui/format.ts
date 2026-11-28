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

/** Below this many km a distance reads better in km than in AU (0.01 AU). */
const KM_BELOW = 1_495_979;

/**
 * A distance in AU, three significant digits ("5,21 UA", "0,0345 UA"), or in km when
 * it's small ("384.000 km").
 * @param au The unit's abbreviation in the language showing ("UA", "AU").
 */
export function formatDistance(km: number, locale: string, au: string): string {
  if (km < KM_BELOW) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'kilometer',
      maximumSignificantDigits: 3,
    }).format(km);
  }
  const number = new Intl.NumberFormat(locale, { maximumSignificantDigits: 3 });
  return `${number.format(km / 149_597_870.7)} ${au}`;
}

/**
 * How long something takes, to the second: "8 min 19 s", "22 h 46 min", "1,3 s". The
 * unit symbols are the same in both languages.
 */
export function formatDuration(seconds: number, locale: string): string {
  if (seconds < 60) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(seconds)} s`;
  }
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min ${whole % 60} s`;
}

/**
 * A speed in km/s, one decimal: "29,8 km/s". The SI symbol in both languages (Intl's
 * Spanish writes "km/seg.").
 */
export function formatSpeed(kmS: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kmS)} km/s`;
}

/**
 * A catalogue date as precise as it is: "5 jul 2016", "dic 2026", "2029".
 * @param date `YYYY-MM-DD`, `YYYY-MM` or `YYYY`.
 */
export function formatLooseDate(date: string, locale: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const parts = date.split('-').length;
  if (parts === 1) return String(year);
  return new Intl.DateTimeFormat(locale, {
    ...(parts === 3 && { day: 'numeric' }),
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace(/\./g, '')
    .replace(/ de /g, ' ');
}
