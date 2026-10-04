const SUPPORTED_LANGUAGES = [
  "el",
  "bg",
  "lv",
  "ko",
  "lt",
  "id",
  "uk",
  "sl",
  "sk",
  "tr",
  "ro",
  "cs",
  "et",
  "fi",
  "da",
  "hu",
  "sv",
  "nb",
  "ru",
  "pl",
  "pt",
  "nl",
  "it",
  "es",
  "fr",
  "de",
  "ja",
  "en",
  "zh",
] as const;

type TRequest = {
  text: string;
  lang: (typeof SUPPORTED_LANGUAGES)[number];
};

class DeepLTranslateFetcher {
  #baseUrl: string;
  #apiKey: string | null;

  constructor() {
    this.#baseUrl = "https://api-free.deepl.com/v2/translate";
    this.#apiKey = null;
  }

  setApiKey(apiKey: string | null | undefined) {
    // Keys are pasted, so trim them: a trailing space would send a free-tier (":fx") key to the paid
    // endpoint. A missing key is stored as none, never as undefined.
    const key = (apiKey ?? "").trim();
    this.#apiKey = key || null;
    this.#baseUrl = key.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";
  }

  async getFullTextTranslation({ text, lang }: TRequest): Promise<string> {
    // Settings use Google-style codes (zh-CN, zh-TW, en, ...); DeepL expects its own codes.
    const targetLang = this.getDeepLLanguageCode(lang);
    // Never fall back to English: the learner picked this language.
    if (!targetLang) {
      throw new Error("DeepL can't translate into this language. Choose another language, or switch to Google Translate.");
    }
    // Only the official API: the keyless web endpoint that used to back "DeepL" is not a public API.
    if (!this.#apiKey || !this.#apiKey.length) {
      throw new Error("DeepL needs an API key (free at deepl.com/pro-api). Add it in the settings, or switch to Google Translate.");
    }

    try {
      const response = await fetch(this.#baseUrl, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLang,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Invalid DeepL API key or quota exceeded");
        }
        throw new Error(`DeepL API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.translations && data.translations.length > 0) {
        return data.translations[0].text;
      }

      throw new Error("No translation received from DeepL");
    } catch (error) {
      console.error("DeepL translation error:", error);
      throw error;
    }
  }

  /** DeepL's target code for a selector (Google-style) code, or null when DeepL can't target it. */
  private getDeepLLanguageCode(googleLangCode: string): string | null {
    const langMap: Record<string, string> = {
      zh: "ZH",
      "zh-cn": "ZH-HANS",
      "zh-tw": "ZH-HANT",
      en: "EN-US",
      de: "DE",
      fr: "FR",
      it: "IT",
      ja: "JA",
      es: "ES",
      nl: "NL",
      pl: "PL",
      ru: "RU",
      pt: "PT-PT",
      sv: "SV",
      da: "DA",
      fi: "FI",
      el: "EL",
      cs: "CS",
      et: "ET",
      hu: "HU",
      lv: "LV",
      lt: "LT",
      sk: "SK",
      sl: "SL",
      bg: "BG",
      ro: "RO",
      ko: "KO",
      id: "ID",
      tr: "TR",
      uk: "UK",
      nb: "NB",
      no: "NB",
      ar: "AR",
      he: "HE",
      th: "TH",
      vi: "VI",
    };
    const code = googleLangCode.toLowerCase();
    return Object.hasOwn(langMap, code) ? langMap[code]! : null;
  }
}

export const deeplTranslateFetcher = new DeepLTranslateFetcher();
