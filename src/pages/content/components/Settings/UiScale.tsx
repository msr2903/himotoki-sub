import { FC } from "react";
import { useUnit } from "effector-react";

import { $uiScale, uiScaleChanged } from "@src/models/settings";
import { UI_SCALE_MAX, UI_SCALE_MIN, UI_SCALE_STEP } from "@src/shared/uiScale";
import { MinusIcon } from "./assets/MinusIcon";
import { PlusIcon } from "./assets/PlusIcon";

/** Size of the word pop-up, hover labels and this panel. */
export const UiScale: FC = () => {
  const [uiScale, setUiScale] = useUnit([$uiScale, uiScaleChanged]);

  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Pop-up size</div>
      <div className="es-settings-content__element__right">
        <button
          className="es-settings-button"
          disabled={uiScale <= UI_SCALE_MIN}
          onClick={() => setUiScale(uiScale - UI_SCALE_STEP)}
        >
          <MinusIcon />
        </button>
        <div className="es-settings-button__value">{uiScale}%</div>
        <button
          className="es-settings-button"
          disabled={uiScale >= UI_SCALE_MAX}
          onClick={() => setUiScale(uiScale + UI_SCALE_STEP)}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
};
