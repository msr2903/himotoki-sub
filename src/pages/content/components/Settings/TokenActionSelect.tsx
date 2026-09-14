import { FC } from "react";
import { useUnit } from "effector-react";

import { $clickAction, $hoverAction, clickActionChanged, hoverActionChanged } from "@src/models/settings";
import { TTokenAction } from "@src/models/types";
import { TOKEN_ACTIONS } from "@src/shared/tokenActions";
import { Select } from "../ui/Select";

const options = TOKEN_ACTIONS.map((a) => ({ value: a.value, label: a.label }));

export const HoverActionSelect: FC = () => {
  const [value, onChange] = useUnit([$hoverAction, hoverActionChanged]);
  return <ActionRow label="On hover" value={value} onChange={onChange} />;
};

export const ClickActionSelect: FC = () => {
  const [value, onChange] = useUnit([$clickAction, clickActionChanged]);
  return <ActionRow label="On click" value={value} onChange={onChange} />;
};

const ActionRow: FC<{ label: string; value: TTokenAction; onChange: (v: TTokenAction) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div className="es-settings-content__element">
    <div className="es-settings-content__element__left">{label}</div>
    <div className="es-settings-content__element__right">
      <Select
        value={options.find((o) => o.value === value)}
        onChange={(option: { value: TTokenAction }) => onChange(option.value)}
        options={options}
      />
    </div>
  </div>
);

export const OpenOptionsPage: FC = () => (
  <div className="es-settings-content__element">
    <div className="es-settings-content__element__left">All settings</div>
    <div className="es-settings-content__element__right">
      <button
        className="es-settings-link-button"
        onClick={(e) => {
          e.stopPropagation();
          void chrome.runtime.sendMessage({ type: "openOptionsPage" });
        }}
      >
        Open settings
      </button>
    </div>
  </div>
);
