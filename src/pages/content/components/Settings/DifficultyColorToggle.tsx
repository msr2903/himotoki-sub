import { FC } from "react";
import { Toggle } from "../ui/Toggle";
import { useUnit } from "effector-react";
import { $colorByDifficulty, colorByDifficultyChanged } from "@src/models/settings";

/** Colour subtitle words by JLPT difficulty. */
export const DifficultyColorToggle: FC = () => {
  const [on, onChange] = useUnit([$colorByDifficulty, colorByDifficultyChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Colour by difficulty</div>
      <div className="es-settings-content__element__right">
        <Toggle isEnabled={on} onChange={onChange} />
      </div>
    </div>
  );
};
