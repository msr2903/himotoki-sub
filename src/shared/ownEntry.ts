/**
 * `record[key]` only when `key` is the record's own property. Caches keyed by subtitle text must
 * not treat inherited Object members (`constructor`, `toString`, `__proto__`) as cached entries.
 */
export const ownEntry = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
