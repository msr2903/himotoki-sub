import { FC } from "react";
import { useUnit } from "effector-react";

import { $coverageStatus } from "@src/models/subs";
import { $videoStats } from "@src/models/stats";

/** This video's known-word coverage, computed from the offline dictionary and your known words. */
export const VideoStats: FC = () => {
  const [stats, status] = useUnit([$videoStats, $coverageStatus]);
  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">This video</div>
      <div className="es-settings-content__element__right es-video-stats">
        {stats == null ? (
          <span className="es-video-stats-empty">{
            status === "loading" ? "Analyzing…" : status === "missing" ? "Install the offline dictionary" :
            status === "error" ? "Could not analyze captions" : "No resolved words"
          }</span>
        ) : (
          <span>
            {stats.known}/{stats.total} words known ({stats.percent}%) · {stats.i1} i+1 lines
          </span>
        )}
      </div>
    </div>
  );
};
