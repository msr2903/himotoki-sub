import { FC } from "react";
import { useUnit } from "effector-react";
import { $newWordsLevel, newWordsLevelChanged } from "@src/models/settings";
import { NEW_WORDS_LEVEL_OPTIONS, TNewWordsLevel } from "@src/shared/newWordsOnly";
import { Select } from "../ui/Select";

const options = NEW_WORDS_LEVEL_OPTIONS.map(({ value, label }) => ({ value, label: value === "off" ? label : `My level: ${label}` }));

/** New words only (beta): blur words at or below the learner's JLPT level. */
export const NewWordsLevelSelect: FC = () => {
  const [value, onChange] = useUnit([$newWordsLevel, newWordsLevelChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">
        New words only <span className="es-beta">Beta</span>
      </div>
      <div className="es-settings-content__element__right">
        <Select
          value={options.find((option) => option.value === value)}
          onChange={(option: { value: TNewWordsLevel }) => onChange(option.value)}
          options={options}
        />
      </div>
    </div>
  );
};
