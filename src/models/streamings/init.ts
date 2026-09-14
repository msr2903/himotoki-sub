import { $streaming, fetchCurrentStreamingFx } from "./";
import { getCurrentService } from "@src/utils/getCurrentService";

fetchCurrentStreamingFx.use(() => getCurrentService());
