import { FC } from "react";
import { useUnit } from "effector-react";

import { $meaningSize, meaningSizeChanged } from "@src/models/settings";
import { MEANING_SIZE_MAX, MEANING_SIZE_MIN, MEANING_SIZE_STEP } from "@src/shared/labelSettings";
import { MinusIcon } from "./assets/MinusIcon";
import { PlusIcon } from "./assets/PlusIcon";

/** Size of the meaning text in the hover label above a word. */
export const MeaningSize: FC = () => {
  const [meaningSize, setMeaningSize] = useUnit([$meaningSize, meaningSizeChanged]);

  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Meaning size</div>
      <div className="es-settings-content__element__right">
        <button
          className="es-settings-button"
          disabled={meaningSize <= MEANING_SIZE_MIN}
          onClick={() => setMeaningSize(meaningSize - MEANING_SIZE_STEP)}
        >
          <MinusIcon />
        </button>
        <div className="es-settings-button__value">{meaningSize}%</div>
        <button
          className="es-settings-button"
          disabled={meaningSize >= MEANING_SIZE_MAX}
          onClick={() => setMeaningSize(meaningSize + MEANING_SIZE_STEP)}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
};
