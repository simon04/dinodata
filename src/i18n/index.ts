import { shallowRef, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
import en from "./en.json";

export type MessageKey = keyof typeof en;
type Messages = Partial<Record<MessageKey, string>>;

/** User-selected language (Wikimedia language code). */
export const language = useLocalStorage(
  "dinodata.language",
  navigator.language.split("-")[0].toLowerCase() || "en",
);

/** Wikimedia language code → BCP 47 locale supported by Intl, else "en". */
export function locale(code = language.value): string {
  try {
    return Intl.getCanonicalLocales(code)[0] ?? "en";
  } catch {
    return "en";
  }
}

// translations other than English are loaded on demand
const loaders = import.meta.glob<{ default: Messages }>([
  "./*.json",
  "!./en.json",
]);
const messages = shallowRef<Messages>({});
watch(
  language,
  async (code) => {
    const load = loaders[`./${code}.json`];
    messages.value = load ? (await load()).default : {};
  },
  { immediate: true },
);

/**
 * Translate a message. Supports MediaWiki-style `$1` parameters and
 * `{{PLURAL:$1|one|other}}`.
 */
export function t(key: MessageKey, ...params: (string | number)[]): string {
  const message = messages.value[key] ?? en[key];
  return message
    .replace(
      /\{\{PLURAL:\$(\d+)\|([^}]*)\}\}/g,
      (_, i: string, forms: string) => {
        const [one, other = one] = forms.split("|");
        const rule = new Intl.PluralRules(locale()).select(
          Number(params[+i - 1]),
        );
        return rule === "one" ? one : other;
      },
    )
    .replace(/\$(\d+)/g, (_, i: string) => String(params[+i - 1] ?? ""));
}
