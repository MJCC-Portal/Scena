// Shared v2 request/response primitives that don't belong in envelopes.ts
// (envelope shapes) or errors.ts (error shapes).

export type IsoTimestamp = string;
export type Uuid = string;

/** Common shape for cursor/offset list responses once a v2 module needs one. */
export interface PagedData<T> {
  items: T[];
  next_offset: number | null;
  total: number | null;
}
