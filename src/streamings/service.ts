import { Captions } from "@src/models/types";

interface Service {
  name: string;

  // Getting subtitles from a service
  getSubs: (language: string) => Promise<Captions>;

  // Optional: a second subtitle track (language code) for dual subtitles. Falls back to getSubs when absent.
  getSecondarySubs?: (language: string) => Promise<Captions>;

  // Player container selector, required to render subtitles
  getSubsContainer: () => HTMLElement | null;

  // Selector for injecting the application icon in the player
  getSettingsButtonContainer: () => HTMLElement | null;

  // Selector for rendering extension settings inside the player container
  getSettingsContentContainer: () => HTMLElement | null;

  // Check if the service is on flight
  isOnFlight: () => boolean;

  // Init the service
  init: () => void;
}

export default Service;
