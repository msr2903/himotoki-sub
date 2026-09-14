import { FC } from "react";
import { useUnit } from "effector-react";

import { $secondarySubs, secondarySubsChanged } from "@src/models/settings";
import { TSecondarySubs } from "@src/models/types";
import { SECONDARY_SUBS_OPTIONS } from "@src/shared/secondarySubs";
import { Select } from "../ui/Select";

const options = SECONDARY_SUBS_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

/** Second subtitle line under the Japanese one. Hotkey: D. */
export const SecondarySubsSelect: FC = () => {
  const [value, onChange] = useUnit([$secondarySubs, secondarySubsChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Second line (D)</div>
      <div className="es-settings-content__element__right">
        <Select
          value={options.find((o) => o.value === value)}
          onChange={(option: { value: TSecondarySubs }) => onChange(option.value)}
          options={options}
        />
      </div>
    </div>
  );
};
