import { FC, useState, useEffect } from "react";
import { useUnit } from "effector-react";

import {
  $deeplApiKeyModalOpen,
  deeplApiKeyModalClosed,
  $deeplApiKey,
  deeplApiKeyChanged,
  translationServiceChanged,
} from "@src/models/settings";

export const DeepLApiKeyModal: FC = () => {
  const [isModalOpen, handleModalClose, currentApiKey, handleApiKeyChange, handleServiceChange] =
    useUnit([
      $deeplApiKeyModalOpen,
      deeplApiKeyModalClosed,
      $deeplApiKey,
      deeplApiKeyChanged,
      translationServiceChanged,
    ]);

  const [tempApiKey, setTempApiKey] = useState(currentApiKey);

  useEffect(() => {
    if (isModalOpen) {
      setTempApiKey(currentApiKey);
    }
  }, [isModalOpen, currentApiKey]);

  const trimmedKey = tempApiKey.trim();

  const handleSave = () => {
    if (!trimmedKey) return;
    handleApiKeyChange(trimmedKey);
    handleModalClose();
  };

  // DeepL only works through its official API, which needs a key. Closing without one would leave
  // every line translation failing, so fall back to Google Translate instead.
  const handleCancel = () => {
    setTempApiKey(currentApiKey);
    if (!currentApiKey.trim()) handleServiceChange("google");
    handleModalClose();
  };

  if (!isModalOpen) {
    return null;
  }

  return (
    <div className="es-modal-overlay">
      <div className="es-modal-content">
        <div className="es-modal-header">
          <h3>DeepL API Key Configuration</h3>
          <button className="es-modal-close" onClick={handleCancel}>
            ×
          </button>
        </div>

        <div className="es-modal-body">
          <div className="es-modal-field">
            <label htmlFor="deepl-api-key">API Key:</label>
            <input
              id="deepl-api-key"
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Enter your DeepL API key"
              className="es-modal-input"
            />
          </div>

          <div className="es-modal-info">
            <p>
              DeepL translations need your own API key. Without one, line
              translations use Google Translate instead.
            </p>
            <p>
              Get your free DeepL API key at{" "}
              <a
                href="https://www.deepl.com/pro-api"
                target="_blank"
                rel="noopener noreferrer"
              >
                deepl.com/pro-api
              </a>
            </p>
            <p>
              Free tier includes 500,000 characters per month - more than enough
              for most users!
            </p>
          </div>
        </div>

        <div className="es-modal-footer">
          <button
            className="es-modal-button es-modal-button--secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="es-modal-button es-modal-button--primary"
            onClick={handleSave}
            disabled={!trimmedKey}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
