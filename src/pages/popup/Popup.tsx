import { HIMOTOKI_API_BASE } from "@src/shared/himotokiConfig";
import { AccountPanel } from "@src/pages/shared/AccountPanel";
import { DictionaryPanel } from "@src/pages/shared/DictionaryPanel";

async function getTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0];
}

const Popup = () => {
  const handleRequestPermissions = async () => {
    const tab = await getTab();
    if (!tab?.url || tab.id == null) return;
    const isGranted = await chrome.permissions.request({
      permissions: ["scripting", "storage", "activeTab"],
      origins: [tab.url],
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
        <li onClick={() => void chrome.runtime.openOptionsPage()}>
          <a className="es-popup-settings">Settings (hover, click, dictionary)</a>
        </li>
        <li>
          <a target="_blank" href={HIMOTOKI_API_BASE} rel="noreferrer">
            Open Himotoki
          </a>
        </li>
        <li onClick={handleRequestPermissions}>
          <a className="es-popup-kinopub">Enable on Kinopub</a>
        </li>
      </menu>
    </div>
  );
};

export default Popup;
