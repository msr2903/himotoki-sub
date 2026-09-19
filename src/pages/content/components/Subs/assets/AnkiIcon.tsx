import { FC } from "react";

/**
 * "Save to Anki" icon: a plus for the add action, switching to a check once the word has been saved
 * (Yomitan-style feedback that a note already exists for it).
 */
export const AnkiIcon: FC<{ saved?: boolean }> = ({ saved }) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {saved ? (
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    )}
  </svg>
);
