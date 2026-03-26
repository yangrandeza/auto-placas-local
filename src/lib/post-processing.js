import { drawWarpedPlate } from "@/lib/utils";

export const DEFAULT_LOCAL_EDIT_RECIPE = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  shadows: 0,
  highlights: 0,
};

export const DEFAULT_GLOBAL_LOOK_RECIPE = {
  presetId: null,
  lutId: null,
  lutIntensity: 100,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  contrast: 0,
};

export function makeLocalEditRecipe(overrides = {}) {
  return { ...DEFAULT_LOCAL_EDIT_RECIPE, ...overrides };
}

export function makeGlobalLookRecipe(overrides = {}) {
  return { ...DEFAULT_GLOBAL_LOOK_RECIPE, ...overrides };
}

export function hasMeaningfulAdjustments(recipe, defaults) {
  if (!recipe) return false;
  return Object.keys(defaults).some((key) => recipe[key] !== defaults[key]);
}

export function parseCubeLut(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  let title = "LUT importada";
  let size = 0;
  const values = [];

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("TITLE")) {
      const match = line.match(/"(.*)"/);
      if (match?.[1]) title = match[1];
      continue;
    }
    if (upper.startsWith("LUT_3D_SIZE")) {
      size = Number.parseInt(line.split(/\s+/)[1] ?? "0", 10);
      continue;
    }
    if (/^[+-]?\d/.test(line)) {
      const [r, g, b] = line.split(/\s+/).map(Number);
      if ([r, g, b].every((value) => Number.isFinite(value))) {
        values.push(r, g, b);
      }
    }
  }

  if (!size || values.length !== size * size * size * 3) {
    throw new Error("Arquivo .cube invalido ou incompleto.");
  }

  return {
    id: `lut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: title,
    size,
    data: Float32Array.from(values),
  };
}

export function applyRecipeToImageData(imageData, localRecipe, globalRecipe, lut) {
  const data = imageData.data;
  const lutIntensity = clampNumber((globalRecipe?.lutIntensity ?? 100) / 100, 0, 1);

  for (let index = 0; index < data.length; index += 4) {
    let r = data[index] / 255;
    let g = data[index + 1] / 255;
    let b = data[index + 2] / 255;

    ({ r, g, b } = applyLocalRecipe({ r, g, b }, localRecipe));
    ({ r, g, b } = applyGlobalRecipe({ r, g, b }, globalRecipe));

    if (lut && lutIntensity > 0) {
      const lutSample = sampleCubeLut(lut, r, g, b);
      r = mix(r, lutSample.r, lutIntensity);
      g = mix(g, lutSample.g, lutIntensity);
      b = mix(b, lutSample.b, lutIntensity);
    }

    data[index] = clampByte(r * 255);
    data[index + 1] = clampByte(g * 255);
    data[index + 2] = clampByte(b * 255);
  }

  return imageData;
}

export function resolveEffectiveGlobalLook(photo, globalRecipe, lut) {
  const shouldApplyGlobal = !photo?.disableGlobalLook;
  return {
    globalRecipe: shouldApplyGlobal ? globalRecipe ?? DEFAULT_GLOBAL_LOOK_RECIPE : DEFAULT_GLOBAL_LOOK_RECIPE,
    lut: shouldApplyGlobal ? lut ?? null : null,
  };
}

export function applyPostEditsToCanvas(canvas, photo, globalRecipe, lut) {
  const activeLocalRecipe = photo?.localEditRecipe ?? DEFAULT_LOCAL_EDIT_RECIPE;
  const effectiveGlobal = resolveEffectiveGlobalLook(photo, globalRecipe, lut);
  const hasLocal = hasMeaningfulAdjustments(activeLocalRecipe, DEFAULT_LOCAL_EDIT_RECIPE);
  const hasGlobal =
    hasMeaningfulAdjustments(effectiveGlobal.globalRecipe, DEFAULT_GLOBAL_LOOK_RECIPE) ||
    Boolean(effectiveGlobal.lut);

  if (!hasLocal && !hasGlobal) return;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const processed = applyRecipeToImageData(
    imageData,
    activeLocalRecipe,
    effectiveGlobal.globalRecipe,
    effectiveGlobal.lut,
  );
  ctx.putImageData(processed, 0, 0);
}

export function renderPhotoToCanvas({
  canvas,
  sourceImage,
  plateImage,
  photo,
  globalRecipe,
  lut,
  maxDimension = null,
}) {
  if (!canvas || !sourceImage || !photo) return null;

  const scale =
    maxDimension && Number.isFinite(maxDimension) && maxDimension > 0
      ? Math.min(maxDimension / Math.max(sourceImage.width, sourceImage.height), 1)
      : 1;

  const width = Math.max(1, Math.round(sourceImage.width * scale));
  const height = Math.max(1, Math.round(sourceImage.height * scale));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(sourceImage, 0, 0, width, height);

  if (plateImage && photo.points?.length === 4) {
    const scaledPhoto = {
      ...photo,
      points: photo.points.map((point) => ({
        x: point.x * scale,
        y: point.y * scale,
      })),
    };
    drawWarpedPlate(ctx, plateImage, scaledPhoto.points);
  }

  applyPostEditsToCanvas(canvas, photo, globalRecipe, lut);

  return { width, height, scale };
}

function applyLocalRecipe(color, recipe = DEFAULT_LOCAL_EDIT_RECIPE) {
  let { r, g, b } = color;
  const exposure = recipe.exposure ?? 0;
  const brightness = recipe.brightness ?? 0;
  const contrast = recipe.contrast ?? 0;
  const saturation = recipe.saturation ?? 0;
  const vibrance = recipe.vibrance ?? 0;
  const temperature = recipe.temperature ?? 0;
  const tint = recipe.tint ?? 0;
  const shadows = recipe.shadows ?? 0;
  const highlights = recipe.highlights ?? 0;

  const exposureFactor = Math.pow(2, exposure / 100);
  r *= exposureFactor;
  g *= exposureFactor;
  b *= exposureFactor;

  r += brightness / 255;
  g += brightness / 255;
  b += brightness / 255;

  ({ r, g, b } = applyContrast({ r, g, b }, contrast));
  ({ r, g, b } = applySaturation({ r, g, b }, saturation));
  ({ r, g, b } = applyVibrance({ r, g, b }, vibrance));
  ({ r, g, b } = applyTemperatureTint({ r, g, b }, temperature, tint));
  ({ r, g, b } = applyShadowsHighlights({ r, g, b }, shadows, highlights));

  return {
    r: clampNumber(r, 0, 1),
    g: clampNumber(g, 0, 1),
    b: clampNumber(b, 0, 1),
  };
}

function applyGlobalRecipe(color, recipe = DEFAULT_GLOBAL_LOOK_RECIPE) {
  let { r, g, b } = color;
  const contrast = recipe.contrast ?? 0;
  const saturation = recipe.saturation ?? 0;
  const vibrance = recipe.vibrance ?? 0;
  const temperature = recipe.temperature ?? 0;
  const tint = recipe.tint ?? 0;

  ({ r, g, b } = applyContrast({ r, g, b }, contrast));
  ({ r, g, b } = applySaturation({ r, g, b }, saturation));
  ({ r, g, b } = applyVibrance({ r, g, b }, vibrance));
  ({ r, g, b } = applyTemperatureTint({ r, g, b }, temperature, tint));

  return {
    r: clampNumber(r, 0, 1),
    g: clampNumber(g, 0, 1),
    b: clampNumber(b, 0, 1),
  };
}

function applyContrast({ r, g, b }, amount) {
  if (!amount) return { r, g, b };
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  return {
    r: factor * (r - 0.5) + 0.5,
    g: factor * (g - 0.5) + 0.5,
    b: factor * (b - 0.5) + 0.5,
  };
}

function applySaturation({ r, g, b }, amount) {
  if (!amount) return { r, g, b };
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const factor = 1 + amount / 100;
  return {
    r: gray + (r - gray) * factor,
    g: gray + (g - gray) * factor,
    b: gray + (b - gray) * factor,
  };
}

function applyVibrance({ r, g, b }, amount) {
  if (!amount) return { r, g, b };
  const max = Math.max(r, g, b);
  const avg = (r + g + b) / 3;
  const factor = 1 + (amount / 100) * (1 - (max - avg));
  return applySaturation({ r, g, b }, (factor - 1) * 100);
}

function applyTemperatureTint({ r, g, b }, temperature, tint) {
  if (!temperature && !tint) return { r, g, b };
  return {
    r: r + temperature / 500 + tint / 900,
    g: g,
    b: b - temperature / 500 + tint / 900,
  };
}

function applyShadowsHighlights({ r, g, b }, shadows, highlights) {
  if (!shadows && !highlights) return { r, g, b };
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const shadowFactor = (1 - luminance) * (shadows / 200);
  const highlightFactor = luminance * (highlights / 200);
  return {
    r: r + shadowFactor - highlightFactor,
    g: g + shadowFactor - highlightFactor,
    b: b + shadowFactor - highlightFactor,
  };
}

function sampleCubeLut(lut, r, g, b) {
  const size = lut.size;
  const scaledR = clampNumber(r, 0, 1) * (size - 1);
  const scaledG = clampNumber(g, 0, 1) * (size - 1);
  const scaledB = clampNumber(b, 0, 1) * (size - 1);

  const r0 = Math.floor(scaledR);
  const g0 = Math.floor(scaledG);
  const b0 = Math.floor(scaledB);
  const r1 = Math.min(r0 + 1, size - 1);
  const g1 = Math.min(g0 + 1, size - 1);
  const b1 = Math.min(b0 + 1, size - 1);

  const fr = scaledR - r0;
  const fg = scaledG - g0;
  const fb = scaledB - b0;

  const c000 = getLutColor(lut, r0, g0, b0);
  const c100 = getLutColor(lut, r1, g0, b0);
  const c010 = getLutColor(lut, r0, g1, b0);
  const c110 = getLutColor(lut, r1, g1, b0);
  const c001 = getLutColor(lut, r0, g0, b1);
  const c101 = getLutColor(lut, r1, g0, b1);
  const c011 = getLutColor(lut, r0, g1, b1);
  const c111 = getLutColor(lut, r1, g1, b1);

  const c00 = mixColor(c000, c100, fr);
  const c10 = mixColor(c010, c110, fr);
  const c01 = mixColor(c001, c101, fr);
  const c11 = mixColor(c011, c111, fr);
  const c0 = mixColor(c00, c10, fg);
  const c1 = mixColor(c01, c11, fg);

  return mixColor(c0, c1, fb);
}

function getLutColor(lut, r, g, b) {
  const offset = ((b * lut.size * lut.size) + (g * lut.size) + r) * 3;
  return {
    r: lut.data[offset],
    g: lut.data[offset + 1],
    b: lut.data[offset + 2],
  };
}

function mixColor(a, b, amount) {
  return {
    r: mix(a.r, b.r, amount),
    g: mix(a.g, b.g, amount),
    b: mix(a.b, b.b, amount),
  };
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
