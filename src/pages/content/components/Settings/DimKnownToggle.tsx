import { FC } from "react";
import { Toggle } from "../ui/Toggle";
import { useUnit } from "effector-react";
import { $dimKnownWords, dimKnownWordsChanged } from "@src/models/settings";

/** Dim words the user has marked as known. */
export const DimKnownToggle: FC = () => {
  const [dim, onChange] = useUnit([$dimKnownWords, dimKnownWordsChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Dim known words</div>
      <div className="es-settings-content__element__right">
        <Toggle isEnabled={dim} onChange={onChange} />
      </div>
    </div>
  );
};
