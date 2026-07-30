export type CollectionKind = "topic" | "alphabet";

export function normalizeCollectionKind(value: unknown): CollectionKind {
  return value === "alphabet" ? "alphabet" : "topic";
}
