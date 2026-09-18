import { FC } from "react";
import { Toggle } from "../ui/Toggle";
import { useUnit } from "effector-react";
import { $ankiRichCards, ankiRichCardsChanged } from "@src/models/settings";

/** Build rich sentence-mining Anki cards (context + screenshot + audio) when saving to Anki. */
export const AnkiRichCardsToggle: FC = () => {
  const [on, onChange] = useUnit([$ankiRichCards, ankiRichCardsChanged]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Rich Anki cards</div>
      <div className="es-settings-content__element__right">
        <Toggle isEnabled={on} onChange={onChange} />
      </div>
    </div>
  );
};
