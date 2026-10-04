import { describe, expect, it } from "vitest";

import { isKinopubPage } from "./serviceHosts";

describe("recognising a KinoPub tab in the popup", () => {
  it("knows KinoPub's hosts and mirrors that carry its title", () => {
    expect(isKinopubPage("https://kino.pub/item/view/1", "Фильм")).toBe(true);
    expect(isKinopubPage("https://mirror.example/item/1", "Фильм — Кинопаб")).toBe(true);
  });

  it("ignores other sites and browser pages", () => {
    // A video about KinoPub on a site with its own adapter is not KinoPub (#159).
    expect(isKinopubPage("https://www.youtube.com/watch?v=x", "Кинопаб review - YouTube")).toBe(false);
    expect(isKinopubPage("https://example.com/", "Example")).toBe(false);
    expect(isKinopubPage("chrome://extensions/", "Кинопаб")).toBe(false);
    expect(isKinopubPage(undefined, undefined)).toBe(false);
  });
});
