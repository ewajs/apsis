/**
 * Converting between the app's clock (UTC) and the ephemeris time scale (TDB),
 * ADR 0004. Pure: the current time is always passed in.
 */

/**
 * TDB − UTC in seconds, valid since the last leap second (2017-01-01): 37 leap seconds
 * (TAI − UTC) plus 32.184 s (TT − TAI). TDB − TT never exceeds 2 ms and is ignored.
 * Earlier dates had fewer leap seconds, so this overstates the offset by up to 21 s
 * for 1977; at a spacecraft's speed that is a few hundred km, invisible at the scales
 * we draw. A leap-second table would fix it if close-ups of old flybys ever need it.
 */
export const TDB_MINUS_UTC_SECONDS = 69.184;

/** The J2000 epoch, 2000-01-01 12:00 TDB, counted like Unix time (seconds since 1970). */
const J2000_AS_UNIX_SECONDS = 946_728_000;

/**
 * A UTC instant, as `Date.now()` gives it (ms since 1970), in TDB seconds since J2000:
 * the time the ephemeris samples use.
 * @example tdbSecondsFromUtcMs(Date.UTC(2000, 0, 1, 11, 58, 50, 816)) // 0
 */
export function tdbSecondsFromUtcMs(utcMs: number): number {
  return utcMs / 1000 + TDB_MINUS_UTC_SECONDS - J2000_AS_UNIX_SECONDS;
}

/** The inverse of `tdbSecondsFromUtcMs`: TDB seconds since J2000 as UTC ms since 1970. */
export function utcMsFromTdbSeconds(tdbSeconds: number): number {
  return (tdbSeconds - TDB_MINUS_UTC_SECONDS + J2000_AS_UNIX_SECONDS) * 1000;
}

/**
 * Reads an instant written as ISO 8601 (`2026-12-03T16:15Z`, or a bare date at 00:00
 * UTC) into UTC ms since 1970, or `null` if it isn't one.
 * @example parseInstant('2026-12-03') // Date.UTC(2026, 11, 3)
 */
export function parseInstant(text: string | null): number | null {
  if (!text || !/^\d{4}-\d{2}-\d{2}/.test(text)) return null;
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00Z` : text);
  return Number.isNaN(ms) ? null : ms;
}
