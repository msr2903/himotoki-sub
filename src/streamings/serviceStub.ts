import { parse } from "subtitle";

import Service from "./service";

/** Placeholder before the real streaming service is detected. Must not throw. */
class ServiceStub implements Service {
  name = "stub";

  public init(): void {
    // no-op — real service replaces this on fetchCurrentStreamingFx
  }

  public async getSubs() {
    return parse("");
  }

  public getSubsContainer(): HTMLElement | null {
    return null;
  }

  public getSettingsButtonContainer(): HTMLElement | null {
    return null;
  }

  public getSettingsContentContainer(): HTMLElement | null {
    return null;
  }

  public isOnFlight() {
    return false;
  }
}

export default ServiceStub;
