import { FC, useEffect, useState } from "react";

import type { TTokenAction } from "@src/models/types";
import { onPersistedChange, readPersisted, writePersisted } from "@src/shared/persistedSettings";
import {
  CLICK_ACTION_SETTING,
  DEFAULT_CLICK_ACTION,
  DEFAULT_HOVER_ACTION,
  HOVER_ACTION_SETTING,
  TOKEN_ACTIONS,
  isTokenAction,
} from "@src/shared/tokenActions";
import { AccountPanel } from "@src/pages/shared/AccountPanel";
import { DictionaryPanel } from "@src/pages/shared/DictionaryPanel";

const TEST_VIDEO = "https://www.youtube.com/watch?v=Jh2C7JlWGKU";

function useSetting(name: string, fallback: TTokenAction) {
  const [value, setValue] = useState<TTokenAction>(fallback);
  useEffect(() => {
    void readPersisted<unknown>(name, fallback).then((v) => setValue(isTokenAction(v) ? v : fallback));
    return onPersistedChange<unknown>(name, (v) => {
      if (isTokenAction(v)) setValue(v);
    });
  }, [name]);
  return [value, (v: TTokenAction) => { setValue(v); void writePersisted(name, v); }] as const;
}

const Welcome: FC = () => {
  const [hover, setHover] = useSetting(HOVER_ACTION_SETTING, DEFAULT_HOVER_ACTION);
  const [click, setClick] = useSetting(CLICK_ACTION_SETTING, DEFAULT_CLICK_ACTION);

  return (
    <div className="es-welcome">
      <header className="es-welcome-hero">
        <div className="header-brand">Himotoki</div>
        <p className="es-welcome-tagline">Japanese subtitles, split into words, with a dictionary one hover away.</p>
      </header>

      <section className="es-welcome-step">
        <div className="es-welcome-num">1</div>
        <div>
          <h2>Download the offline dictionary</h2>
          <p className="es-popup-hint">One download, then every lookup is instant and works without the network.</p>
          <DictionaryPanel />
        </div>
      </section>

      <section className="es-welcome-step">
        <div className="es-welcome-num">2</div>
        <div>
          <h2>Choose what hovering and clicking do</h2>
          <div className="es-welcome-actions">
            <label>
              On hover
              <select value={hover} onChange={(e) => isTokenAction(e.target.value) && setHover(e.target.value)}>
                {TOKEN_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              On click
              <select value={click} onChange={(e) => isTokenAction(e.target.value) && setClick(e.target.value)}>
                {TOKEN_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="es-popup-hint">
            Hover results vanish when the pointer leaves; click results stay pinned until Escape or a click elsewhere.
            You can change these any time in the settings page.
          </p>
        </div>
      </section>

      <section className="es-welcome-step">
        <div className="es-welcome-num">3</div>
        <div>
          <h2>Sign in to save words (optional)</h2>
          <p className="es-popup-hint">Saved words keep the sentence, video link and timestamp on your Himotoki account.</p>
          <AccountPanel />
        </div>
      </section>

      <section className="es-welcome-step">
        <div className="es-welcome-num">4</div>
        <div>
          <h2>Try it</h2>
          <p className="es-popup-hint">
            Open a video with Japanese captions. The Himotoki button appears in the player controls; the subtitles
            appear over the video. If the site shows the player's own captions, this extension prefers the Japanese
            track automatically on YouTube.
          </p>
          <a className="es-popup-btn es-popup-btn-primary es-welcome-cta" href={TEST_VIDEO} target="_blank" rel="noreferrer">
            Open a test video
          </a>
          <p className="es-popup-hint">
            If you also use Yomitan, exclude video sites in Yomitan's settings so you do not get two pop-ups.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Welcome;
