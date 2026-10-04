import { ReactElement, MouseEvent, useEffect, useMemo, useState, useRef, FC } from "react";
import { useUnit } from "effector-react";

import { $video, moveToTimeRequested } from "@src/models/videos";
import { $subs } from "@src/models/subs";
import { getCurrentVideoTime } from "@src/utils/getCurrentVideoTime";
import { cuesInWindow, indexCues, markerGeometry, timeAtPointer } from "@src/shared/cueWindow";

type TProgressBarProps = Record<string, never>;
const TIME_PERIOD = 30000;

export const ProgressBar: FC<TProgressBarProps> = () => {
  const [video, subs] = useUnit([$video, $subs]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [elements, updateElements] = useState<ReactElement[]>([]);
  const animateRef = useRef<number>();
  // Indexed once per track, so each frame only touches the cues near the playhead.
  const cueIndex = useMemo(() => indexCues(subs), [subs]);
  // What the markers were last drawn for: a paused video (same time, same width) skips the frame.
  const drawnRef = useRef<{ time: number; width: number } | null>(null);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!video || !progressBarRef.current) {
      return;
    }
    const time = getCurrentVideoTime(video);
    // Relative to the timeline itself: offsetX would be relative to whichever marker was clicked.
    const moveTime = timeAtPointer(
      event.clientX,
      progressBarRef.current.getBoundingClientRect(),
      time - TIME_PERIOD / 2,
      TIME_PERIOD,
    );
    if (moveTime !== null) moveToTimeRequested(moveTime);
  }

  // Updating the rendering state of the progress bar
  const updateProgressBar = (): void => {
    if (!video || !progressBarRef.current) {
      return;
    }

    const time = getCurrentVideoTime(video);
    const width = progressBarRef.current.parentElement.clientWidth;
    const drawn = drawnRef.current;
    if (drawn && drawn.time === time && drawn.width === width) return;
    drawnRef.current = { time, width };
    const windowStart = time - TIME_PERIOD / 2;

    const subsInDuration = cuesInWindow(cueIndex, windowStart, windowStart + TIME_PERIOD);

    updateElements(
      subsInDuration.map((sub) => {
        // Clipped to the window, so a cue spanning it fills the bar instead of overflowing it.
        const marker = markerGeometry(sub, windowStart, TIME_PERIOD, width);
        return (
          <div
            className="es-progress-bar-element"
            style={{ width: `${marker.width}px`, transform: `translateX(${marker.x}px)` }}
            key={`id${sub.start}-${sub.end}-${sub.text}`}
          />
        );
      })
    );
  };

  const animate = (): void => {
    if (subs.length === 0) return;
    updateProgressBar();
    animateRef.current = requestAnimationFrame(animate);
  };

  // We use requestAnimationFrame for performance animation
  useEffect(() => {
    // New track or video: draw the next frame even if the clock has not moved.
    drawnRef.current = null;
    animateRef.current = requestAnimationFrame(animate);
    // addKeyboardEventsListeners();

    return () => {
      animateRef.current && cancelAnimationFrame(animateRef.current);
      // removeKeyboardEventsListeners();
      updateElements([]);
    };
  }, [cueIndex, progressBarRef.current, video]);

  return (
    <div className="es-progress-bar-container" onClick={handleClick} ref={progressBarRef}>
      {elements}
    </div>
  );
};
