import { FC } from "react";
import { useUnit } from "effector-react";
import { $pitchDisplay, pitchDisplayChanged } from "@src/models/settings";
import { PITCH_DISPLAY_OPTIONS, TPitchDisplay } from "@src/shared/pitchSettings";
import { Select } from "../ui/Select";

const options = PITCH_DISPLAY_OPTIONS.map(({ value, label }) => ({ value, label }));

export const PitchDisplaySelect: FC = () => {
  const [value, onChange] = useUnit([$pitchDisplay, pitchDisplayChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Pitch accent</div>
      <div className="es-settings-content__element__right">
        <Select
          value={options.find((option) => option.value === value)}
          onChange={(option: { value: TPitchDisplay }) => onChange(option.value)}
          options={options}
        />
      </div>
    </div>
  );
};
