/** Building blocks for the settings page, mirroring the himotoki web app's settings controls. */
import { FC, ReactNode, useEffect, useState } from "react";
import cn from "classnames";

const ICON_PATHS = {
  cursor: <path d="M5 3.5 19 10l-6.2 1.9L10.5 18z" />,
  captions: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7 11h3M13 11h4M7 15h7" />
    </>
  ),
  mouse: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="6" />
      <path d="M12 7v3.5" />
    </>
  ),
  cards: (
    <>
      <rect x="3" y="6" width="14" height="14" rx="2.5" />
      <path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
    </>
  ),
  box: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
    </>
  ),
  pulse: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  back: <path d="m15 5-7 7 7 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_PATHS;
export type Tint = "teal" | "blue" | "violet" | "coral" | "amber" | "grey";

export const Icon: FC<{ name: IconName; size?: number }> = ({ name, size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {ICON_PATHS[name]}
  </svg>
);

export const TintedIcon: FC<{ name: IconName; tint: Tint }> = ({ name, tint }) => (
  <span className="menu-icon" data-tint={tint}>
    <Icon name={name} />
  </span>
);

export const Card: FC<{ title?: ReactNode; className?: string; children: ReactNode }> = ({ title, className, children }) => (
  <section className={cn("card", className)}>
    {title && <h2 className="card-title">{title}</h2>}
    {children}
  </section>
);

const ItemText: FC<{ title: ReactNode; hint?: ReactNode; htmlFor?: string }> = ({ title, hint, htmlFor }) => (
  <span className="item-text">
    {htmlFor ? (
      <label className="item-title" htmlFor={htmlFor}>
        {title}
      </label>
    ) : (
      <span className="item-title">{title}</span>
    )}
    {hint && <span className="item-hint">{hint}</span>}
  </span>
);

/** A row with free-form content on the right (buttons, counts). */
export const Item: FC<{ title: ReactNode; hint?: ReactNode; id?: string; children?: ReactNode }> = ({
  title,
  hint,
  id,
  children,
}) => (
  <div className="item" id={id}>
    <ItemText title={title} hint={hint} />
    {children}
  </div>
);

export const ToggleRow: FC<{
  id: string;
  title: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ id, title, hint, checked, onChange }) => (
  <label className="item toggle-item">
    <span className="item-text">
      <span className="item-title">{title}</span>
      {hint && <span className="item-hint">{hint}</span>}
    </span>
    <input
      id={id}
      className="toggle"
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);

export type Option<T extends string> = { value: T; label: string; description?: string };

const describe = <T extends string>(options: ReadonlyArray<Option<T>>, value: T) =>
  options.find((o) => o.value === value)?.description;

/** A long list of choices: title and the current choice's description above a full-width select. */
export function SelectRow<T extends string>({
  id,
  title,
  hint,
  value,
  options,
  onChange,
  guard,
}: {
  id: string;
  title: string;
  hint?: ReactNode;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (v: T) => void;
  guard: (v: unknown) => v is T;
}) {
  return (
    <div className="item stack-item">
      <ItemText title={title} hint={hint ?? describe(options, value)} htmlFor={id} />
      <select
        id={id}
        className="field"
        value={value}
        onChange={(e) => {
          if (guard(e.target.value)) onChange(e.target.value);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Two or three choices as a segmented row of chips. */
export function ChipsRow<T extends string>({
  id,
  title,
  hint,
  value,
  options,
  onChange,
}: {
  id: string;
  title: string;
  hint?: ReactNode;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="item stack-item">
      <ItemText title={title} hint={hint ?? describe(options, value)} />
      <div className="chips" role="radiogroup" aria-label={title} id={id}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={cn("chip", { on: value === o.value })}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** −/+ number control. */
export const StepperRow: FC<{
  id: string;
  title: string;
  hint?: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}> = ({ id, title, hint, value, min, max, step, unit, onChange }) => {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  return (
    <div className="item">
      <ItemText title={title} hint={hint} />
      <div className="stepper" role="group" aria-label={title} id={id}>
        <button
          type="button"
          className="step-btn"
          aria-label={`Decrease ${title.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => set(value - step)}
        >
          −
        </button>
        <span className="step-value" aria-live="polite">
          {value}
          {unit && <small>{unit}</small>}
        </span>
        <button
          type="button"
          className="step-btn"
          aria-label={`Increase ${title.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => set(value + step)}
        >
          +
        </button>
      </div>
    </div>
  );
};

export const TextRow: FC<{
  id: string;
  title: string;
  hint?: ReactNode;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
}> = ({ id, title, hint, value, placeholder, onChange, onBlur }) => (
  <div className="item stack-item">
    <ItemText title={title} hint={hint} htmlFor={id} />
    <input
      id={id}
      type="text"
      className="field"
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
    />
  </div>
);

export const SearchField: FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <div className="search">
    <Icon name="search" size={17} />
    <input
      type="search"
      value={value}
      placeholder="Search settings"
      aria-label="Search settings"
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
    />
    {value && (
      <button type="button" className="search-clear" aria-label="Clear search" onClick={() => onChange("")}>
        <Icon name="close" size={15} />
      </button>
    )}
  </div>
);

export const MenuRow: FC<{ icon: IconName; tint: Tint; title: string; summary?: string; onClick: () => void }> = ({
  icon,
  tint,
  title,
  summary,
  onClick,
}) => (
  <button type="button" className="menu-row" onClick={onClick}>
    <TintedIcon name={icon} tint={tint} />
    <span className="item-text">
      <span className="item-title">{title}</span>
      {summary && <span className="item-hint">{summary}</span>}
    </span>
    <span className="menu-chevron">
      <Icon name="chevron" size={18} />
    </span>
  </button>
);

/** Destructive action that needs a second click within a few seconds. */
export const ConfirmButton: FC<{ label: string; disabled?: boolean; onConfirm: () => void }> = ({
  label,
  disabled,
  onConfirm,
}) => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={cn("pill", { danger: armed })}
      disabled={disabled}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? "Click to confirm" : label}
    </button>
  );
};
