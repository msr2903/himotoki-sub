import { FC } from "react";
import { useUnit } from "effector-react";

import { $playbackRate, playbackRateSpeedDown, playbackRateSpeedUp, playbackRateChanged } from "@src/models/settings";
import { PLAYBACK_RATE_MAX, PLAYBACK_RATE_MIN } from "@src/shared/playbackRate";
import { MinusIcon } from "./assets/MinusIcon";
import { PlusIcon } from "./assets/PlusIcon";

/** Video playback speed. , and . adjust it in the player; \ replays the current line slowed. */
export const PlaybackSpeed: FC = () => {
  const [rate, down, up, setRate] = useUnit([
    $playbackRate,
    playbackRateSpeedDown,
    playbackRateSpeedUp,
    playbackRateChanged,
  ]);

  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Playback speed</div>
      <div className="es-settings-content__element__right">
        <button className="es-settings-button" disabled={rate <= PLAYBACK_RATE_MIN} onClick={() => down()}>
          <MinusIcon />
        </button>
        <div className="es-settings-button__value">{rate}×</div>
        <button className="es-settings-button" disabled={rate >= PLAYBACK_RATE_MAX} onClick={() => up()}>
          <PlusIcon />
        </button>
        {rate !== 1 && (
          <button className="es-settings-link-button" onClick={() => setRate(1)} style={{ marginLeft: 8 }}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
