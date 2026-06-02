export type ImportedVariable = {
  key: string;
  value: string;
};

function stringifyImportedValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseDotEnvVariables(raw: string): ImportedVariable[] {
  const entries: ImportedVariable[] = [];

  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(normalizedLine.slice(separatorIndex + 1).trim());

    if (key) {
      entries.push({ key, value });
    }
  }

  return entries;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenJsonValue(keyPrefix: string, value: unknown): ImportedVariable[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenJsonValue(`${keyPrefix}__${index}`, item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([childKey, childValue]) =>
      flattenJsonValue(`${keyPrefix}__${childKey}`, childValue)
    );
  }

  return [{ key: keyPrefix, value: stringifyImportedValue(value) }];
}

function parseJsonVariables(raw: string): ImportedVariable[] {
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => {
      if (
        item &&
        typeof item === "object" &&
        "key" in item &&
        "value" in item &&
        typeof item.key === "string"
      ) {
        return [{ key: item.key, value: stringifyImportedValue(item.value) }];
      }
      return [];
    });
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("JSON import must be an object or an array of { key, value } entries.");
  }

  return Object.entries(parsed).flatMap(([key, value]) => flattenJsonValue(key, value));
}

function dedupeImportedVariables(entries: ImportedVariable[]): ImportedVariable[] {
  const merged = new Map<string, string>();
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) {
      continue;
    }
    merged.set(key, entry.value);
  }

  return [...merged.entries()].map(([key, value]) => ({ key, value }));
}

export function parseImportedVariables(raw: string): ImportedVariable[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const entries = trimmed.startsWith("{") || trimmed.startsWith("[")
    ? parseJsonVariables(trimmed)
    : parseDotEnvVariables(trimmed);

  return dedupeImportedVariables(entries);
}

export async function loadTextFromFile(file: File): Promise<string> {
  return await file.text();
}
