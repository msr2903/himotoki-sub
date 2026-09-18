import { FC } from "react";

/** Bookmark icon for the save action; `filled` marks an already-saved (known) word. */
export const SaveIcon: FC<{ filled?: boolean }> = ({ filled }) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M4 2.5h8a1 1 0 0 1 1 1v10a.5.5 0 0 1-.8.4L8 11.1l-4.2 2.8a.5.5 0 0 1-.8-.4v-10a1 1 0 0 1 1-1z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);
