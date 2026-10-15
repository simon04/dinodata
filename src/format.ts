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
