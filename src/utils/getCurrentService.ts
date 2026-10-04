import KinoPub from "@src/streamings/kinopub";
import Youtube from "@src/streamings/youtube";
import Coursera from "@src/streamings/coursera";
import Netflix from "@src/streamings/netflix";
import NetflixOnFlight from "@src/streamings/netflixOnFlight";
import Service from "@src/streamings/service";
import ServiceStub from "@src/streamings/serviceStub";
import Plex from "@src/streamings/plex";
import Udemy from "@src/streamings/udemy";
import Kinopoisk from "@src/streamings/kinopoisk";
import Amazon from "@src/streamings/amazon";
import Inoriginal from "@src/streamings/inoriginal";

const KINOPUB_HOSTS = ["kinopub.net", "kino.pub", "kinopub.cc", "moviesjoy.is"];
const isAmazonVideoHost = (host: string) => host === "www.primevideo.com" || /^www\.amazon\.[a-z.]+$/.test(host);

const markPage = (id: string) => document.querySelector("html")?.setAttribute("id", id);

const youtube = () => {
  markPage("youtube");
  if (document.querySelector(".ytp-delhi-modern")) {
    // Add class for new youtube delphi design
    document.body.classList.add("es-youtube-delphi");
  }
  return new Youtube();
};
const netflix = () => {
  markPage("netflix");
  return document.body.classList.contains("es-netflix-on-flight") ? new NetflixOnFlight() : new Netflix();
};
const kinopub = () => {
  markPage("kinopub");
  return new KinoPub();
};
const coursera = () => {
  markPage("coursera");
  return new Coursera();
};

/**
 * Pick the adapter by the page's host first: a page title names its content (a Coursera course
 * about YouTube), not its player. Only players that run on hosts we can't list fall back to page
 * markers: KinoPub mirrors (granted from the popup) and self-hosted Plex servers.
 */
export const getCurrentService = (): Service => {
  const host = window.location.host;
  if (host === "www.youtube.com") return youtube();
  if (host === "www.netflix.com") return netflix();
  if (host === "www.coursera.org") return coursera();
  if (KINOPUB_HOSTS.includes(host)) return kinopub();
  if (host === "app.plex.tv") return new Plex();
  if (host === "www.udemy.com") return new Udemy();
  if (host === "hd.kinopoisk.ru") return new Kinopoisk();
  if (isAmazonVideoHost(host)) return new Amazon();
  if (host === "inoriginal.online") return new Inoriginal();

  const titleContent = document.querySelector("title")?.textContent;
  if (titleContent?.includes("Кинопаб") || document.querySelector('meta[content="Кинопаб"]') != null) {
    return kinopub();
  }
  if (document.querySelector("body div")?.id === "plex") return new Plex();

  return new ServiceStub();
};
