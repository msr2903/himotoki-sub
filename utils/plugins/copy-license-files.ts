import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PluginOption } from "vite";

/** Include canonical legal notices in every extension build without maintaining duplicate copies. */
export default function copyLicenseFiles(rootDir: string): PluginOption {
  const files = ["LICENSE", "LICENSES/MIT-upstream.txt", "THIRD_PARTY_NOTICES.md", "SOURCE.md"];
  return {
    name: "copy-license-files",
    buildStart() {
      for (const file of files) this.addWatchFile(resolve(rootDir, file));
    },
    generateBundle() {
      for (const fileName of files) {
        this.emitFile({ type: "asset", fileName, source: readFileSync(resolve(rootDir, fileName)) });
      }
    },
  };
}
