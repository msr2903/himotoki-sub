import { FC } from "react";
import { useUnit } from "effector-react";

import { $mouseActions, mouseActionChanged } from "@src/models/settings";
import { TMouseAction, TMouseButton } from "@src/models/types";
import { MOUSE_ACTIONS, MOUSE_BUTTONS } from "@src/shared/mouseActions";
import { Select } from "../ui/Select";

const options = MOUSE_ACTIONS.map((a) => ({ value: a.value, label: a.label }));

/** One row per extra mouse button (middle, back, forward); active while the pointer is over the video. */
export const MouseActionSelect: FC<{ button: TMouseButton }> = ({ button }) => {
  const [value, onChange] = useUnit([$mouseActions[button], mouseActionChanged]);
  const label = MOUSE_BUTTONS.find((b) => b.id === button)!.label;
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">{label}</div>
      <div className="es-settings-content__element__right">
        <Select
          value={options.find((o) => o.value === value)}
          onChange={(option: { value: TMouseAction }) => onChange({ button, action: option.value })}
          options={options}
        />
      </div>
    </div>
  );
};
