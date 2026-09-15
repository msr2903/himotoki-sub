import { FC } from "react";
import { useUnit } from "effector-react";

import { transcriptToggled } from "@src/models/subs";

/** Open the searchable transcript panel (also toggled with the T hotkey). */
export const OpenTranscript: FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const toggle = useUnit(transcriptToggled);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Transcript</div>
      <div className="es-settings-content__element__right">
        <button
          className="es-settings-link-button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
            onOpen?.();
          }}
        >
          Open (T)
        </button>
      </div>
    </div>
  );
};
