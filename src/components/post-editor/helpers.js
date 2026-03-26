import { makeGlobalLookRecipe } from "@/lib/post-processing";

export function mapXmpToGlobalRecipe(parsedXmp) {
  const description = findFirstDescriptionNode(parsedXmp);
  if (!description) return makeGlobalLookRecipe();

  return makeGlobalLookRecipe({
    contrast: normalizeXmpValue(description["crs:Contrast2012"]),
    saturation: normalizeXmpValue(description["crs:Saturation"]),
    vibrance: normalizeXmpValue(description["crs:Vibrance"]),
    temperature: normalizeTemperature(description["crs:Temperature"]),
    tint: normalizeTint(description["crs:Tint"]),
  });
}

function findFirstDescriptionNode(node) {
  if (!node || typeof node !== "object") return null;
  if (node["rdf:Description"]) return node["rdf:Description"];
  for (const value of Object.values(node)) {
    if (typeof value === "object") {
      const found = findFirstDescriptionNode(value);
      if (found) return found;
    }
  }
  return null;
}

function normalizeXmpValue(value) {
  if (value == null) return 0;
  return clampValue(Number(value), -100, 100);
}

function normalizeTemperature(value) {
  if (value == null) return 0;
  return clampValue((Number(value) - 5500) / 20, -100, 100);
}

function normalizeTint(value) {
  if (value == null) return 0;
  return clampValue(Number(value), -100, 100);
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}
