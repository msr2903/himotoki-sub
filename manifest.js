import fs from "node:fs";
const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));

/**
 * After changing, please reload the extension at `chrome://extensions`
 * @type {chrome.runtime.ManifestV3}
 */

const manifest = {
  manifest_version: 3,
  // Public key that pins the Chrome extension ID to nokohimndngikmodbepekdbhobminahp, so
  // unpacked builds and the Google sign-in redirect URL
  // (https://nokohimndngikmodbepekdbhobminahp.chromiumapp.org/) are the same on every machine.
  // Not a secret: the matching private key is only needed to pack a .crx. Firefox ignores it.
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmfY5tVUmW2qDvqfqCnbugqrpkwD5aZfB9ZF5nr3WVZzVmaEfXIMu9F+g6E+0HfJNtttYcHHgx/XYfHDGJWN999RrvF4JBdbkRdG6BdTNmYKeXQFHlhImpunK9hW+/LyEn5Caghb0U9YOL0VQRu/ApLaqEyeOgze0uKEWMFVLx23GtZ5pKBlHtPKLPVsZh7Xz6JxEJP05IygyN9X00PAGeoM9IP/a+VlhyN37QpaYm0nlM3fxldN9gwHHuYwg45WbrNiqOPDdjiXuG6gkifslALUcy5lkxWLkPWFgxDQlMnzPKM9fwpOR6Ti8TQCEA3D2JiTbFhElcN9HSgLl4JacYQIDAQAB",
  // Public key: keeps the extension ID stable across machines and unpacked reloads (see store/README.md).
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvwDOMGKm/xmBAUn/BEuxgg8na1+SY5Eqn3TbNpsvm2VW+MBxYAPzmRQmE40pOm9Hu2+QLlKFEKQWbGvJ6yv0zVHrJCpVGAaYoQCHKrBw1XPg44O9gbvSX6BRwLPqnnbqAf+YksP+VRUDg/rzWxHpKV/Q1zU11GhIZexd0Jl2YaZlym0fh5oyngE3kjtz3/4XOWypvTnca12lz2VxhFG0A6wBCeXeZg9iMo+6foS79rwq4/pvEBfcS1alS9zU17LNByIAt71SvbbU+ZHi/k5hg4ipLuDGpJPggwBIPoXSfEwxrqCO8EDzMbGCnmu5gelGV2IKEQySWGyHzr0KKY5zBwIDAQAB",
  default_locale: "en",
  name: "__MSG_appName__",
  version: packageJson.version,
  description: "__MSG_appDescription__",
  background: {
    service_worker: "src/pages/background/index.js",
    type: "module",
  },
  action: {
    default_popup: "src/pages/popup/index.html",
    default_icon: "icon-128.png",
  },
  options_ui: {
    page: "src/pages/options/index.html",
    open_in_tab: true,
  },
  icons: {
    128: "icon-128.png",
  },
  content_scripts: [
    {
      matches: [
        "https://www.netflix.com/*",
        "https://www.youtube.com/*",
        "https://www.coursera.org/*",
        "https://kinopub.net/*",
        "https://kino.pub/*",
        "https://kinopub.cc/*",
        "https://app.plex.tv/*",
        "https://plex.ukrapka.tech/*",
        "https://www.udemy.com/course/*/learn/lecture/*",
        "https://hd.kinopoisk.ru/*",
        "https://www.amazon.de/Amazon-Video/*",
        "https://www.primevideo.com/*",
        "https://www.amazon.de/*/video/*",
        "https://inoriginal.online/*",
      ],
      js: ["src/pages/contentInjected/index.js"],
      // KEY for cache invalidation
      css: ["assets/css/contentStyle<KEY>.chunk.css"],
    },
  ],
  permissions: ["scripting", "storage", "unlimitedStorage", "activeTab", "offscreen", "identity"],
  optional_host_permissions: ["*://*/*"],
  optional_permissions: [],
  host_permissions: [
    // Offline dictionary is a self-hosted GitHub release asset; the download 302-redirects from
    // github.com to *.githubusercontent.com, so both origins are needed.
    "https://github.com/*",
    "https://*.githubusercontent.com/*",
    // The optional "Save to Himotoki" account feature: Google sign-in, Firebase Auth and the
    // user's saved-words document in Firestore (the same account as himotoki.web.app).
    "https://accounts.google.com/*",
    "https://identitytoolkit.googleapis.com/*",
    "https://securetoken.googleapis.com/*",
    "https://firestore.googleapis.com/*",
    "https://translate.google.com/*",
    "http://localhost:8765/*",
    "https://api-free.deepl.com/*",
    "https://api.deepl.com/*",
    "https://www2.deepl.com/*",
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  web_accessible_resources: [
    {
      resources: [
        "assets/js/*.js",
        "assets/css/*.css",
        "icon-128.png",
        "icon-34.png",
        "models/*",
        "ort/*",
        "fonts/*",
      ],
      matches: ["*://*/*"],
    },
  ],
  browser_specific_settings: {
    gecko: {
      id: "{4077aa9d-b753-4913-8e52-27ef408d4c82}",
    },
  },
};

export default manifest;
