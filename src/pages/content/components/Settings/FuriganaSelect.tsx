import { FC } from "react";
import { useUnit } from "effector-react";

import { $furigana, $furiganaLevel, $readingLine, furiganaChanged, furiganaLevelChanged, readingLineChanged } from "@src/models/settings";
import { TFuriganaLevel, TFuriganaMode, TReadingLineMode } from "@src/models/types";
import { FURIGANA_OPTIONS, READING_LINE_OPTIONS } from "@src/shared/furiganaSettings";
import { FURIGANA_LEVEL_OPTIONS } from "@src/shared/furiganaDifficulty";
import { Select } from "../ui/Select";

const furiganaOptions = FURIGANA_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const readingLineOptions = READING_LINE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const furiganaLevelOptions = FURIGANA_LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

/** Inline ruby furigana over kanji tokens. */
export const FuriganaSelect: FC = () => {
  const [value, onChange] = useUnit([$furigana, furiganaChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Furigana</div>
      <div className="es-settings-content__element__right">
        <Select
          value={furiganaOptions.find((o) => o.value === value)}
          onChange={(option: { value: TFuriganaMode }) => onChange(option.value)}
          options={furiganaOptions}
        />
      </div>
    </div>
  );
};

/** Skip furigana on words at/below a JLPT level the learner already knows. */
export const FuriganaLevelSelect: FC = () => {
  const [value, onChange] = useUnit([$furiganaLevel, furiganaLevelChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Furigana difficulty</div>
      <div className="es-settings-content__element__right">
        <Select
          value={furiganaLevelOptions.find((o) => o.value === value)}
          onChange={(option: { value: TFuriganaLevel }) => onChange(option.value)}
          options={furiganaLevelOptions}
        />
      </div>
    </div>
  );
};

/** The channel's kana reading line: hide it or keep it as text. */
export const ReadingLineSelect: FC = () => {
  const [value, onChange] = useUnit([$readingLine, readingLineChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Reading line</div>
      <div className="es-settings-content__element__right">
        <Select
          value={readingLineOptions.find((o) => o.value === value)}
          onChange={(option: { value: TReadingLineMode }) => onChange(option.value)}
          options={readingLineOptions}
        />
      </div>
    </div>
  );
};
