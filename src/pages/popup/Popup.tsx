import { AccountPanel } from "@src/pages/shared/AccountPanel";
import { DictionaryPanel } from "@src/pages/shared/DictionaryPanel";
import { useEffect, useState } from "react";
import { originMatchPattern } from "@src/shared/runtimeConfig";

async function getTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0];
}

const Popup = () => {
  const [kinopubUrl, setKinopubUrl] = useState<string | null>(null);

  useEffect(() => {
    void getTab().then((tab) => {
      if (!tab?.url) return;
      try {
        const host = new URL(tab.url).hostname;
        if (["kinopub.net", "kino.pub", "kinopub.cc"].includes(host)) setKinopubUrl(tab.url);
      } catch {
        // Browser internal tabs do not have a supported site URL.
      }
    });
  }, []);

  const handleRequestPermissions = async () => {
    const tab = await getTab();
    if (!tab?.url || tab.id == null || !kinopubUrl) return;
    const origin = originMatchPattern(tab.url);
    if (!origin) return;
    const isGranted = await chrome.permissions.request({
      origins: [origin],
    });
    if (isGranted) {
      chrome.tabs.reload(tab.id);
    }
  };

  return (
    <div className="content">
      <div className="header">
        <span className="header-brand">Himotoki</span>
        <span className="header-sub">Sub</span>
      </div>

      <section className="es-popup-dict">
        <div className="es-popup-section-title">Offline dictionary</div>
        <DictionaryPanel compact />
      </section>

      <section className="es-popup-account">
        <div className="es-popup-section-title">Account</div>
        <AccountPanel />
      </section>

      <menu>
        <li>
          <button type="button" className="es-popup-menu-action" onClick={() => void chrome.runtime.openOptionsPage()}>
            Open settings
          </button>
        </li>
        {kinopubUrl && (
          <li>
            <button type="button" className="es-popup-menu-action es-popup-kinopub" onClick={handleRequestPermissions}>
              Enable on Kinopub
            </button>
          </li>
        )}
      </menu>
    </div>
  );
};

export default Popup;
