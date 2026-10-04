import { FC, useState, PropsWithChildren } from "react";
import { createPortal } from "react-dom";

import { $streaming } from "@src/models/streamings";

import { useUnit } from "effector-react";
import { SettingsContent } from "./SettingsContent";
import { MonoLogo } from "./assets/MonoLogo";
import { Toaster } from "react-hot-toast";
import { useOverlayPortalTarget } from "@src/hooks/useOverlayPortalTarget";

type TSettingsProps = {
  contentContainer: HTMLElement;
};

export const Settings: FC<TSettingsProps> = () => {
  const [showSettings, setShowSettings] = useState(false);
  const streaming = useUnit($streaming);
  const toastTarget = useOverlayPortalTarget();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    setShowSettings(!showSettings);
  };
  return (
    <>
      <button type="button" className="es-settings-icon" aria-label="Open Himotoki settings" aria-expanded={showSettings} onClick={handleClick}>
        <MonoLogo />
      </button>
      {showSettings &&
        createPortal(
          <SettingsContent onClose={() => setShowSettings(false)} />,
          streaming.getSettingsContentContainer(),
        )}
      {createPortal(
        <div className="es-toast">
          <Toaster />
        </div>,
        toastTarget,
      )}
    </>
  );
};
