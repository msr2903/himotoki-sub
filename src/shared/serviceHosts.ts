/** KinoPub's own hosts. Its mirrors move often, so they are recognised by the page title instead. */
export const KINOPUB_HOSTS = ["kinopub.net", "kino.pub", "kinopub.cc", "moviesjoy.is"];

/** The title KinoPub gives its pages, which the mirrors keep. */
export const KINOPUB_TITLE = "Кинопаб";

export const isAmazonVideoHost = (host: string) => host === "www.primevideo.com" || /^www\.amazon\.[a-z.]+$/.test(host);

const OTHER_ADAPTER_HOSTS = [
  "www.youtube.com",
  "www.netflix.com",
  "www.coursera.org",
  "app.plex.tv",
  "www.udemy.com",
  "hd.kinopoisk.ru",
  "inoriginal.online",
];

/** Hosts whose adapter is chosen by host alone; their page titles name content, not the player. */
export const hasHostAdapter = (host: string): boolean =>
  KINOPUB_HOSTS.includes(host) || OTHER_ADAPTER_HOSTS.includes(host) || isAmazonVideoHost(host);

/** Whether a tab shows KinoPub: one of its hosts, or a mirror on an unlisted host carrying its title. */
export function isKinopubPage(url: string | undefined, title: string | undefined): boolean {
  if (!url || !/^https?:/.test(url)) return false;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  if (KINOPUB_HOSTS.includes(host)) return true;
  return !hasHostAdapter(host) && Boolean(title?.includes(KINOPUB_TITLE));
}
