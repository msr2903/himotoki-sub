import { createStore, createEffect, createEvent } from "effector";
import type Service from "@src/streamings/service";
import ServiceStub from "@src/streamings/serviceStub";

export const $streaming = createStore<Service>(new ServiceStub());

export const streamingDetected = createEvent<Service>();
export const fetchCurrentStreamingFx = createEffect<void, Service>();

$streaming.on(streamingDetected, (_, streaming) => streaming);
$streaming.on(fetchCurrentStreamingFx.doneData, (_, streaming) => streaming);
