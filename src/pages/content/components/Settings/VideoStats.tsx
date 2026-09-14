import { FC } from "react";
import { useUnit } from "effector-react";

import { $videoStats } from "@src/models/subs";

/** This video's known-word coverage, computed from the offline dictionary and your known words. */
export const VideoStats: FC = () => {
  const stats = useUnit($videoStats);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">This video</div>
      <div className="es-settings-content__element__right es-video-stats">
        {stats == null ? (
          <span className="es-video-stats-empty">Analyzing…</span>
        ) : (
          <span>
            {stats.known}/{stats.total} words known ({stats.percent}%) · {stats.i1} i+1 lines
          </span>
        )}
      </div>
    </div>
  );
};
