import Decimal from "decimal.js";

import type { PricePoint } from "@/domain/market";

import { HttpError } from "@/domain/errors";

import { withTimeout } from "../http/exact-fetch";
import type { HistorySource } from "./repository";

/** Daily closes on the wire and in server-rendered props: `[epoch ms, exact decimal string]`. */
export type WirePoint = readonly [number, string];

export const encodePoints = (points: readonly PricePoint[]): WirePoint[] => points.map((point) => [point.date, point.value.toString()]);

export const decodePoints = (points: readonly WirePoint[]): PricePoint[] =>
  points.map(([date, value]) => ({ date, value: new Decimal(value) }));

export const historyRoute = (securityID: string) => `/api/market/history/${encodeURIComponent(securityID)}`;

/** Daily history through this site's route handler, which bounds it to one year. */
export const routeHistorySource: HistorySource = async (securityID, signal) => {
  const response = await fetch(historyRoute(securityID), { headers: { accept: "application/json" }, signal: withTimeout(signal) });
  if (!response.ok) throw new HttpError(response.status);
  const body = (await response.json()) as { points?: unknown };
  if (!Array.isArray(body.points)) throw new HttpError(502);
  return decodePoints(
    body.points.filter(
      (point): point is WirePoint => Array.isArray(point) && typeof point[0] === "number" && typeof point[1] === "string" && /^\d+(\.\d+)?$/.test(point[1]),
    ),
  );
};
