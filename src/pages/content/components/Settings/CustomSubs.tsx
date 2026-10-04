import { ChangeEvent, FC, useEffect, useRef } from "react";
import { useUnit } from "effector-react";

import { ES_CUSTOM_SUB_LABEL, esSubsChanged, updateCustomSubsFx } from "@src/models/subs";
import { notifyError } from "@src/pages/content/notify";
import { latestOnly, parseSubtitleFile, STALE } from "@src/utils/customSubtitleFile";

export const CustomSubs: FC = () => {
  const [handleUpdateCustomSubsFx] = useUnit([updateCustomSubsFx]);
  // The latest selected file owns the track; a slower earlier read is dropped (#145).
  const reads = useRef(latestOnly());
  useEffect(() => () => reads.current.cancel(), []);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    // Selecting the same file again (after fixing it) must fire another change.
    input.value = "";
    if (!file) return;
    let text: string | typeof STALE;
    try {
      text = await reads.current.run(file.text());
    } catch {
      notifyError(`"${file.name}" could not be read.`, "custom-subs");
      return;
    }
    if (text === STALE) return;
    // An empty or non-subtitle file keeps the working track (#156).
    const result = parseSubtitleFile(text, file.name);
    if ("error" in result) {
      notifyError(result.error, "custom-subs");
      return;
    }
    handleUpdateCustomSubsFx(result.cues);
    esSubsChanged(ES_CUSTOM_SUB_LABEL);
  };

  return (
    <div className="es-settings-content__element">
      <div className="es-settings-content__element__left">Custom subtitles</div>
      <div className="es-settings-content__element__right">
        <input type="file" id="file" accept=".srt,.vtt,text/vtt" onChange={(e) => void handleFileChange(e)} className="es-input" />
        <label htmlFor="file" className="es-input__label">
          Select file
        </label>
      </div>
    </div>
  );
};
