import { defaultKindDefinitions } from "./constants";

export function normalizeKindName(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

export function sanitizeKindId(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

export function sanitizeKindColor(color: unknown, fallback = defaultKindDefinitions[0].color): string {
  return /^#[0-9a-f]{6}$/i.test(String(color || "")) ? String(color).toLowerCase() : fallback;
}

export function normalizeTags(value: unknown): string[] {
  const source = Array.isArray(value) ? value.join(",") : String(value || "");
  return [...new Set(
    source
      .split(/[,#]/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .map((tag) => tag.replace(/\s+/g, "-").slice(0, 32)),
  )].slice(0, 12);
}
