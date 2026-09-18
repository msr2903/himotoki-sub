import { FC } from "react";
import { Toggle } from "../ui/Toggle";
import { Select } from "../ui/Select";
import { useUnit } from "effector-react";
import { $ankiCardTheme, $ankiRichCards, ankiCardThemeChanged, ankiRichCardsChanged } from "@src/models/settings";
import { ANKI_CARD_THEME_OPTIONS } from "@src/shared/ankiSettings";
import type { TAnkiCardTheme } from "@src/utils/ankiNote";

const themeOptions = ANKI_CARD_THEME_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

/** Build rich sentence-mining Anki cards (context + screenshot + audio) when saving to Anki. */
export const AnkiRichCardsToggle: FC = () => {
  const [on, onChange] = useUnit([$ankiRichCards, ankiRichCardsChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Rich Anki cards</div>
      <div className="es-settings-content__element__right">
        <Toggle isEnabled={on} onChange={onChange} />
      </div>
    </div>
  );
};

/** Light/dark theme for the generated Anki card. */
export const AnkiCardThemeSelect: FC = () => {
  const [value, onChange] = useUnit([$ankiCardTheme, ankiCardThemeChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Anki card theme</div>
      <div className="es-settings-content__element__right">
        <Select
          value={themeOptions.find((o) => o.value === value)}
          onChange={(option: { value: TAnkiCardTheme }) => onChange(option.value)}
          options={themeOptions}
        />
      </div>
    </div>
  );
};
