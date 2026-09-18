import { FC } from "react";

/** Star icon for the "save to Anki" action; `filled` marks an already-saved word. */
export const AnkiIcon: FC<{ filled?: boolean }> = ({ filled }) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M8 1.6l1.9 3.85 4.25.62-3.07 3 .72 4.23L8 11.3l-3.8 2 .72-4.23-3.07-3 4.25-.62z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);
