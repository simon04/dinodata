import { inject, ref, type InjectionKey, type Ref } from "vue";

/** User-selected language, provided by App. */
export const LANGUAGE: InjectionKey<Ref<string>> = Symbol("language");

export function useLanguage(): Ref<string> {
  return inject(LANGUAGE, ref("en"));
}

/** Wikimedia language code → BCP 47 locale supported by Intl, else "en". */
function locale(language: string): string {
  try {
    return Intl.getCanonicalLocales(language)[0] ?? "en";
  } catch {
    return "en";
  }
}

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
  const era = bce ? " BCE" : "";
  const n = (v: number) => formatNumber(v, language, { useGrouping: false });
  const ordinal = (v: number) => {
    if (!locale(language).startsWith("en")) return `${n(v)}.`;
    const rule = new Intl.PluralRules("en", { type: "ordinal" }).select(v);
    return `${v}${{ one: "st", two: "nd", few: "rd" }[rule as string] ?? "th"}`;
  };
  if (precision === 8) return `${n(year)}s${era}`;
  if (precision === 7)
    return `${ordinal(Math.floor((year - 1) / 100) + 1)} century${era}`;
  if (precision === 6)
    return `${ordinal(Math.floor((year - 1) / 1000) + 1)} millennium${era}`;
  return `${formatNumber(year, language)} years${era}`;
}
