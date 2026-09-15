import { FC, useEffect, useState } from "react";

type ConjForm = { label: string; form: string; reading: string };

/** On-demand conjugation paradigm for a dictionary entry, generated locally by the rules engine. */
export const ConjugationTable: FC<{ seq: number }> = ({ seq }) => {
  const [forms, setForms] = useState<ConjForm[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    void chrome.runtime
      .sendMessage({ type: "himotokiConjTable", seq })
      .then((resp) => {
        if (!live) return;
        const list = (resp?.data?.forms as ConjForm[] | null) ?? null;
        if (!resp?.ok) setState("error");
        else if (!list || !list.length) setState("empty");
        else {
          setForms(list);
          setState("ready");
        }
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [seq]);

  if (state === "loading") return <div className="es-conj-status">Building conjugations…</div>;
  if (state === "empty") return <div className="es-conj-status">No conjugations for this word.</div>;
  if (state === "error" || !forms) return <div className="es-conj-status">Could not build conjugations.</div>;

  return (
    <table className="es-conj-table">
      <tbody>
        {forms.map((f) => (
          <tr key={f.label}>
            <th>{f.label}</th>
            <td>
              <span className="es-conj-form">{f.form}</span>
              {f.reading && f.reading !== f.form && <span className="es-conj-reading">{f.reading}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
