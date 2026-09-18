import { FC } from "react";
import { Toggle } from "../ui/Toggle";
import { useUnit } from "effector-react";
import { $listeningMode, listeningModeChanged } from "@src/models/settings";

/** Blur the subtitle text for listening practice; reveal on hover or the H peek hotkey. */
export const ListeningModeToggle: FC = () => {
  const [on, onChange] = useUnit([$listeningMode, listeningModeChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Listening mode</div>
      <div className="es-settings-content__element__right">
        <Toggle isEnabled={on} onChange={onChange} />
      </div>
    </div>
  );
};
