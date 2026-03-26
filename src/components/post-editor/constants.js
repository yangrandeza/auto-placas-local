export const LOCAL_CONTROLS = [
  ["exposure", "Exposicao", -100, 100],
  ["brightness", "Brilho", -120, 120],
  ["contrast", "Contraste", -100, 100],
  ["highlights", "Highlights", -100, 100],
  ["shadows", "Sombras", -100, 100],
  ["temperature", "Temperatura", -100, 100],
  ["tint", "Tint", -100, 100],
  ["saturation", "Saturacao", -100, 100],
  ["vibrance", "Vibrance", -100, 100],
];

export const GLOBAL_CONTROLS = [
  ["contrast", "Contraste", -100, 100],
  ["temperature", "Temperatura", -100, 100],
  ["tint", "Tint", -100, 100],
  ["saturation", "Saturacao", -100, 100],
  ["vibrance", "Vibrance", -100, 100],
  ["lutIntensity", "Intensidade LUT", 0, 100],
];

export const SECTION_DEFAULTS = {
  local: true,
  global: true,
  assets: true,
  actions: true,
};
