import { FC } from "react";

import { default as ReactSelect, Props } from "react-select";
import { useOverlayPortalTarget } from "@src/hooks/useOverlayPortalTarget";

const customStyles = {
  control: (baseStyles, _state) => ({
    ...baseStyles,
    background: "#141413",
    color: "#e8e6e1",
    border: "1px solid #2e2e2b",
    borderRadius: "6px",
    minHeight: "24px",
    height: "24px",
    boxShadow: "none",
  }),
  menuPortal: (provided) => ({ ...provided, zIndex: 10000, fontSize: "14px" }),
  menu: (provided) => ({
    ...provided,
    zIndex: 10000,
    background: "#1c1c1a",
    border: "1px solid #2e2e2b",
  }),
  valueContainer: (provided, _state) => ({
    ...provided,
    height: "24px",
    padding: "0 4px",
    color: "#e8e6e1",
  }),
  indicatorsContainer: (provided, _state) => ({
    ...provided,
    height: "24px",
  }),
  singleValue: (baseStyles) => ({ ...baseStyles, color: "#e8e6e1", fontSize: "14px" }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (provided) => ({ ...provided, padding: "0 4px" }),
  option: (base, state) => ({
    ...base,
    color: "#e8e6e1",
    background: state.isSelected
      ? "#3dbeb0"
      : state.isFocused
        ? "rgba(61, 190, 176, 0.14)"
        : "#1c1c1a",
  }),
};

const theme = (theme) => ({
  ...theme,
  colors: {
    ...theme.colors,
    neutral30: "#e8e6e1",
    neutral80: "#e8e6e1",
    primary: "#3dbeb0",
    primary25: "rgba(61, 190, 176, 0.14)",
    primary50: "rgba(61, 190, 176, 0.22)",
  },
});

export const Select: FC<Props> = (props) => {
  // Full-screen renders only the fullscreen element's subtree — the menu must portal there,
  // not into document.body, or it opens invisibly.
  const portalTarget = useOverlayPortalTarget();
  return (
    <div style={{ width: "100%", minWidth: "160px" }}>
      <ReactSelect
        {...props}
        styles={customStyles}
        theme={theme}
        menuPortalTarget={portalTarget}
        menuPosition="fixed"
      />
    </div>
  );
};
