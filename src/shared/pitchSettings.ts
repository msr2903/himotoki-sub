export type TPitchDisplay = "contour" | "number" | "hidden";

export const PITCH_DISPLAY_SETTING = "pitchDisplay";
export const DEFAULT_PITCH_DISPLAY: TPitchDisplay = "contour";
export const PITCH_DISPLAY_OPTIONS: ReadonlyArray<{
  value: TPitchDisplay;
  label: string;
  description: string;
}> = [
  { value: "contour", label: "Contour and number", description: "Show a pitch line for every recorded accent pattern." },
  { value: "number", label: "Numbers only", description: "Show compact accent numbers without pitch lines." },
  { value: "hidden", label: "Hide pitch accent", description: "Leave pitch accent out of the dictionary pop-up." },
];

export const isPitchDisplay = (value: unknown): value is TPitchDisplay =>
  value === "contour" || value === "number" || value === "hidden";
