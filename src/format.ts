import { locale, t } from "./i18n";

export function formatNumber(
  value: number | string,
  language: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale(language), {
    maximumFractionDigits: 20,
    ...options,
  }).format(Number(value));
}

/** Format a Wikibase time value respecting its precision. */
export function formatTime(
  time: string,
  precision: number,
  language: string,
): string {
  const m = time.match(/^([+-])0*(\d+)-(\d\d)-(\d\d)/);
  if (!m) return time;
  const [, sign, yearString, month, day] = m;
  const bce = sign === "-";
  const year = Number(yearString);
  if (precision >= 9) {
    const date = new Date(
      Date.UTC(2000, Math.max(+month - 1, 0), Math.max(+day, 1)),
    );
    date.setUTCFullYear(bce ? 1 - year : year);
    return new Intl.DateTimeFormat(locale(language), {
      timeZone: "UTC",
      year: "numeric",
      month: precision >= 10 ? "long" : undefined,
      day: precision >= 11 ? "numeric" : undefined,
      era: bce ? "short" : undefined,
    }).format(date);
  }
  const era = (text: string) => (bce ? t("time-bce", text) : text);
  const n = (v: number) => formatNumber(v, language, { useGrouping: false });
  const ordinal = (v: number) => {
    if (locale(language).startsWith("nl")) return `${n(v)}e`;
    if (!locale(language).startsWith("en")) return `${n(v)}.`;
    const rule = new Intl.PluralRules("en", { type: "ordinal" }).select(v);
    return `${v}${{ one: "st", two: "nd", few: "rd" }[rule as string] ?? "th"}`;
  };
  if (precision === 8) return era(t("time-decade", n(year)));
  if (precision === 7)
    return era(t("time-century", ordinal(Math.floor((year - 1) / 100) + 1)));
  if (precision === 6)
    return era(
      t("time-millennium", ordinal(Math.floor((year - 1) / 1000) + 1)),
    );
  return era(t("time-years", formatNumber(year, language)));
}

/** "3 months ago" for an ISO timestamp. */
export function formatRelativeTime(
  timestamp: string,
  language: string,
  now = Date.now(),
): string {
  const seconds = (Date.parse(timestamp) - now) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 3600],
    ["month", 30 * 24 * 3600],
    ["week", 7 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["minute", 60],
  ];
  const format = new Intl.RelativeTimeFormat(locale(language), {
    numeric: "auto",
  });
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size)
      return format.format(Math.round(seconds / size), unit);
  return format.format(Math.round(seconds), "second");
}
