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

  setApiKey(apiKey: string) {
    this.#apiKey = apiKey;
    this.#baseUrl = apiKey.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";
  }

  async getFullTextTranslation({ text, lang }: TRequest): Promise<string> {
    // Settings use Google-style codes (zh-CN, zh-TW, en, ...); DeepL expects its own codes.
    const targetLang = this.getDeepLLanguageCode(lang);
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

  private getDeepLLanguageCode(googleLangCode: string): string {
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
      ar: "AR",
    };
    return langMap[googleLangCode.toLowerCase()] || "EN-US";
  }
}

export const deeplTranslateFetcher = new DeepLTranslateFetcher();
