import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { isRTL, language, locale, t } from ".";

afterEach(() => {
  language.value = "en";
});

describe("locale", () => {
  it("canonicalizes Wikimedia language codes", () => {
    expect(locale("de")).toBe("de");
    expect(locale("zh-hans")).toBe("zh-Hans");
    expect(locale("be-tarask")).toBe("be-tarask");
  });

  it("falls back to English for invalid codes", () => {
    expect(locale("not a language")).toBe("en");
  });
});

describe("isRTL", () => {
  it.each([
    ["ar", true],
    ["he", true],
    ["fa", true],
    ["ks-arab", true],
    ["en", false],
    ["de", false],
    ["zh-hans", false],
  ])("%s → %s", (code, rtl) => {
    expect(isRTL(code)).toBe(rtl);
  });
});

describe("t", () => {
  it("replaces parameters", () => {
    language.value = "en";
    expect(t("copy-id", "Q42")).toBe("Copy Q42");
  });

  it("picks English plural forms", () => {
    language.value = "en";
    expect(t("copied-statements", 1)).toMatch(/^Copied 1 statement as/);
    expect(t("copied-statements", 2)).toMatch(/^Copied 2 statements as/);
  });

  it("loads translations on demand", async () => {
    language.value = "de";
    await vi.waitFor(() => expect(t("copy-id", "Q42")).toBe("Q42 kopieren"));
  });

  it("falls back from a language variant to its base language", async () => {
    language.value = "de-at";
    await vi.waitFor(() => expect(t("copy-id", "Q42")).toBe("Q42 kopieren"));
  });

  it("falls back to English for untranslated languages", async () => {
    language.value = "de";
    await vi.waitFor(() => expect(t("copy-id", "Q1")).toBe("Q1 kopieren"));
    language.value = "sv";
    await vi.waitFor(() => expect(t("copy-id", "Q1")).toBe("Copy Q1"));
  });

  it("picks all six Arabic plural forms in CLDR order", async () => {
    language.value = "ar";
    await vi.waitFor(() =>
      expect(t("copied-statements", 0)).toMatch(/^لم يُنسخ أي بيان/),
    );
    expect(t("copied-statements", 1)).toMatch(/^نُسخ بيان واحد/);
    expect(t("copied-statements", 2)).toMatch(/^نُسخ بيانان/);
    expect(t("copied-statements", 3)).toMatch(/^نُسخت 3 بيانات/);
    expect(t("copied-statements", 11)).toMatch(/^نُسخ 11 بيانًا/);
    expect(t("copied-statements", 100)).toMatch(/^نُسخ 100 بيان /);
  });

  it("uses the last form for categories without one (English zero)", () => {
    language.value = "en";
    expect(t("copied-statements", 0)).toMatch(/^Copied 0 statements/);
  });
});
