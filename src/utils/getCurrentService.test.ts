import { afterEach, describe, expect, it, vi } from "vitest";

// The real detector with every adapter replaced by a named double.
const adapter = vi.hoisted(() => (name: string) => ({ default: class { name = name; } }));
vi.mock("@src/streamings/youtube", () => adapter("youtube"));
vi.mock("@src/streamings/netflix", () => adapter("netflix"));
vi.mock("@src/streamings/netflixOnFlight", () => adapter("netflix-on-flight"));
vi.mock("@src/streamings/coursera", () => adapter("coursera"));
vi.mock("@src/streamings/kinopub", () => adapter("kinopub"));
vi.mock("@src/streamings/plex", () => adapter("plex"));
vi.mock("@src/streamings/udemy", () => adapter("udemy"));
vi.mock("@src/streamings/kinopoisk", () => adapter("kinopoisk"));
vi.mock("@src/streamings/amazon", () => adapter("amazon"));
vi.mock("@src/streamings/inoriginal", () => adapter("inoriginal"));
vi.mock("@src/streamings/serviceStub", () => adapter("stub"));

import { getCurrentService } from "./getCurrentService";

function detect(host: string, title = "", { kinopubMeta = false, plexRoot = false } = {}) {
  const html = { setAttribute: vi.fn() };
  vi.stubGlobal("window", { location: { host, hostname: host } });
  vi.stubGlobal("document", {
    body: { classList: { add: vi.fn(), contains: () => false } },
    querySelector: (selector: string) => {
      if (selector === "title") return { textContent: title };
      if (selector === "html") return html;
      if (selector === 'meta[content="Кинопаб"]') return kinopubMeta ? {} : null;
      if (selector === "body div") return plexRoot ? { id: "plex" } : null;
      return null;
    },
  });
  return getCurrentService().name;
}

afterEach(() => vi.unstubAllGlobals());

describe("getCurrentService", () => {
  it("routes the advertised hosts whose detection was commented out (#153)", () => {
    expect(detect("app.plex.tv", "Plex")).toBe("plex");
    expect(detect("www.udemy.com", "Lecture")).toBe("udemy");
    expect(detect("hd.kinopoisk.ru", "Кинопоиск")).toBe("kinopoisk");
    expect(detect("www.primevideo.com", "Prime Video")).toBe("amazon");
    expect(detect("www.amazon.de", "Amazon.de: Prime Video")).toBe("amazon");
  });

  it("a known host wins over a title naming another platform (#159)", () => {
    expect(detect("www.coursera.org", "Welcome · Coursera")).toBe("coursera");
    expect(detect("www.coursera.org", "Twitter, LinkedIn, and YouTube Marketing · Coursera")).toBe("coursera");
    expect(detect("www.coursera.org", "Netflix Business Strategy · Coursera")).toBe("coursera");
    expect(detect("www.udemy.com", "The Complete YouTube Course")).toBe("udemy");
    expect(detect("www.youtube.com", "Netflix trailer - YouTube")).toBe("youtube");
    expect(detect("www.netflix.com", "Netflix")).toBe("netflix");
    expect(detect("inoriginal.online", "YouTube in original")).toBe("inoriginal");
  });

  it("recognizes KinoPub mirrors and self-hosted Plex on other hosts", () => {
    expect(detect("kinopub.net", "")).toBe("kinopub");
    expect(detect("mirror.example", "Кинопаб — фильм")).toBe("kinopub");
    expect(detect("mirror.example", "", { kinopubMeta: true })).toBe("kinopub");
    expect(detect("192.168.1.10:32400", "Plex", { plexRoot: true })).toBe("plex");
  });

  it("does not pick a platform for an unknown site from its title", () => {
    expect(detect("blog.example", "My favourite YouTube channels")).toBe("stub");
    expect(detect("blog.example", "Netflix picks · Coursera notes · Prime Video")).toBe("stub");
  });
});
