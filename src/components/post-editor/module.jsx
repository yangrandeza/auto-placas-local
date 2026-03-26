import { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Copy,
  Layers3,
  Palette,
  Save,
  Sparkles,
  Square,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_GLOBAL_LOOK_RECIPE,
  DEFAULT_LOCAL_EDIT_RECIPE,
  makeGlobalLookRecipe,
  makeLocalEditRecipe,
  parseCubeLut,
} from "@/lib/post-processing";

const LOCAL_CONTROLS = [
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

const GLOBAL_CONTROLS = [
  ["contrast", "Contraste", -100, 100],
  ["temperature", "Temperatura", -100, 100],
  ["tint", "Tint", -100, 100],
  ["saturation", "Saturacao", -100, 100],
  ["vibrance", "Vibrance", -100, 100],
  ["lutIntensity", "Intensidade LUT", 0, 100],
];

export default function PostEditorModule({
  photos,
  activePhoto,
  activeId,
  setActiveId,
  selectedPhotoIds,
  setSelectedPhotoIds,
  globalLookRecipe,
  setGlobalLookRecipe,
  customLuts,
  setCustomLuts,
  customPresets,
  setCustomPresets,
  localClipboard,
  setLocalClipboard,
  activePreviewUrl,
  updatePhotoEdits,
  applyLocalRecipeToSelected,
  applyGlobalLookToScope,
  showFeedback,
  closeEditor,
}) {
  const [tab, setTab] = useState("local");
  const [localPresetName, setLocalPresetName] = useState("");
  const [globalPresetName, setGlobalPresetName] = useState("");

  const activeLocalRecipe = activePhoto?.localEditRecipe ?? DEFAULT_LOCAL_EDIT_RECIPE;
  const selectedCount = selectedPhotoIds.length;

  const globalPresetOptions = useMemo(
    () => customPresets.filter((preset) => preset.scope === "global"),
    [customPresets],
  );

  const localPresetOptions = useMemo(
    () => customPresets.filter((preset) => preset.scope === "local"),
    [customPresets],
  );

  useEffect(() => {
    if (!activeId) return;
    if (selectedPhotoIds.length === 0) {
      setSelectedPhotoIds([activeId]);
    }
  }, [activeId, selectedPhotoIds.length, setSelectedPhotoIds]);

  const toggleSelection = (photoId) => {
    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId],
    );
  };

  const setLocalField = (field, value) => {
    if (!activePhoto) return;
    updatePhotoEdits(activePhoto.id, {
      localEditRecipe: {
        ...activeLocalRecipe,
        [field]: value,
      },
    });
  };

  const resetLocalRecipe = () => {
    if (!activePhoto) return;
    updatePhotoEdits(activePhoto.id, {
      localEditRecipe: makeLocalEditRecipe(),
    });
  };

  const savePreset = (scope) => {
    const name = (scope === "local" ? localPresetName : globalPresetName).trim();
    if (!name) {
      showFeedback("info", "Defina um nome para salvar o preset.");
      return;
    }
    const preset = {
      id: `${scope}-preset-${Date.now()}`,
      name,
      scope,
      recipe: scope === "local" ? { ...activeLocalRecipe } : { ...globalLookRecipe },
    };
    setCustomPresets((current) => [...current, preset]);
    if (scope === "local") setLocalPresetName("");
    if (scope === "global") setGlobalPresetName("");
    showFeedback("success", `Preset ${name} salvo.`);
  };

  const applyPreset = (preset, scope) => {
    if (scope === "local" && activePhoto) {
      updatePhotoEdits(activePhoto.id, { localEditRecipe: makeLocalEditRecipe(preset.recipe) });
      return;
    }
    if (scope === "global") {
      setGlobalLookRecipe(makeGlobalLookRecipe(preset.recipe));
    }
  };

  const importCube = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lut = parseCubeLut(text);
      setCustomLuts((current) => [...current, lut]);
      setGlobalLookRecipe((current) => ({
        ...current,
        lutId: lut.id,
      }));
      showFeedback("success", `LUT ${lut.name} importada.`);
    } catch (error) {
      showFeedback("error", error.message || "Falha ao importar LUT.");
    } finally {
      event.target.value = "";
    }
  };

  const importXmp = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { XMLParser } = await import("fast-xml-parser");
      const text = await file.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
      const parsed = parser.parse(text);
      const recipe = mapXmpToGlobalRecipe(parsed);
      setGlobalLookRecipe((current) => ({ ...current, ...recipe }));
      showFeedback("success", "Preset XMP importado com subset suportado.");
    } catch {
      showFeedback("error", "Nao foi possivel ler esse preset XMP.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[rgba(2,6,23,0.7)] backdrop-blur-sm">
      <div className="absolute inset-x-3 bottom-3 top-3 grid grid-cols-1 gap-3 overflow-hidden rounded-[32px] border border-white/10 bg-[rgba(4,9,20,0.96)] shadow-[0_30px_120px_rgba(0,0,0,0.45)] xl:grid-cols-[1.2fr_360px]">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="accent">editor pos</Badge>
                <Badge variant="default">{selectedCount} selecionada(s)</Badge>
              </div>
              <h2 className="mt-2 font-display text-3xl text-white">MicroLightroom</h2>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                Ajuste individual por foto e look global em lote, sem sair do fluxo.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={closeEditor}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 xl:grid-cols-[1fr_320px]">
            <Card className="min-h-0 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-200" />
                  Preview pós-placa
                </CardTitle>
                <CardDescription>
                  O preview principal do app continua sendo a base. Aqui controlamos as receitas individual e global.
                </CardDescription>
              </CardHeader>
              <CardContent className="scrollbar-none flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-white/10 bg-white/[0.03] p-2">
                  <button
                    type="button"
                    onClick={() => setTab("local")}
                    className={`rounded-[18px] px-4 py-3 text-sm font-medium transition ${tab === "local" ? "bg-cyan-300/12 text-white" : "text-[color:var(--muted-foreground)]"}`}
                  >
                    Correcao individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("global")}
                    className={`rounded-[18px] px-4 py-3 text-sm font-medium transition ${tab === "global" ? "bg-cyan-300/12 text-white" : "text-[color:var(--muted-foreground)]"}`}
                  >
                    Look global
                  </button>
                </div>

                {tab === "local" ? (
                  <section className="space-y-4">
                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
                      {activePreviewUrl ? (
                        <img src={activePreviewUrl} alt={activePhoto?.fileName ?? "Preview"} className="max-h-[360px] w-full object-contain" />
                      ) : (
                        <div className="grid h-[280px] place-items-center text-sm text-[color:var(--muted-foreground)]">
                          Preview carregando...
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setLocalClipboard({ ...activeLocalRecipe })}>
                        <Copy className="h-4 w-4" />
                        Copiar desta foto
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => localClipboard && updatePhotoEdits(activeId, { localEditRecipe: makeLocalEditRecipe(localClipboard) })}
                        disabled={!localClipboard || !activePhoto}
                      >
                        Colar nesta foto
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => localClipboard && applyLocalRecipeToSelected(makeLocalEditRecipe(localClipboard))}
                        disabled={!localClipboard || selectedCount === 0}
                      >
                        Colar na selecao
                      </Button>
                      <Button variant="outline" size="sm" onClick={resetLocalRecipe}>
                        Resetar local
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      {LOCAL_CONTROLS.map(([field, label, min, max]) => (
                        <SliderField
                          key={field}
                          label={label}
                          value={activeLocalRecipe[field]}
                          min={min}
                          max={max}
                          onChange={(value) => setLocalField(field, value)}
                        />
                      ))}
                    </div>

                    <Card className="border-white/8 bg-black/15">
                      <CardContent className="space-y-3 p-4">
                        <div className="text-sm font-medium text-white">Salvar preset local</div>
                        <div className="flex gap-2">
                          <input
                            value={localPresetName}
                            onChange={(event) => setLocalPresetName(event.target.value)}
                            placeholder="Nome do preset local"
                            className="h-11 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none"
                          />
                          <Button variant="secondary" onClick={() => savePreset("local")}>
                            <Save className="h-4 w-4" />
                            Salvar
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {localPresetOptions.map((preset) => (
                            <Button key={preset.id} variant="ghost" size="sm" onClick={() => applyPreset(preset, "local")}>
                              {preset.name}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                ) : (
                  <section className="space-y-4">
                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
                      {activePreviewUrl ? (
                        <img src={activePreviewUrl} alt={activePhoto?.fileName ?? "Preview"} className="max-h-[360px] w-full object-contain" />
                      ) : (
                        <div className="grid h-[280px] place-items-center text-sm text-[color:var(--muted-foreground)]">
                          Preview carregando...
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => applyGlobalLookToScope("selected")}>
                        <Layers3 className="h-4 w-4" />
                        Aplicar look na selecao
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => applyGlobalLookToScope("all")}>
                        <Palette className="h-4 w-4" />
                        Aplicar look em todas
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setGlobalLookRecipe(makeGlobalLookRecipe())}
                      >
                        Resetar look global
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      {GLOBAL_CONTROLS.map(([field, label, min, max]) => (
                        <SliderField
                          key={field}
                          label={label}
                          value={globalLookRecipe[field]}
                          min={min}
                          max={max}
                          onChange={(value) => setGlobalLookRecipe((current) => ({ ...current, [field]: value }))}
                        />
                      ))}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <UploadCard label="Subir LUT .cube" onChange={importCube} />
                      <UploadCard label="Subir preset XMP" onChange={importXmp} />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <Card className="border-white/8 bg-black/15">
                        <CardContent className="space-y-3 p-4">
                          <div className="text-sm font-medium text-white">LUT ativa</div>
                          <select
                            value={globalLookRecipe.lutId ?? ""}
                            onChange={(event) => setGlobalLookRecipe((current) => ({ ...current, lutId: event.target.value || null }))}
                            className="h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none"
                          >
                            <option value="">Sem LUT</option>
                            {customLuts.map((lut) => (
                              <option key={lut.id} value={lut.id}>{lut.name}</option>
                            ))}
                          </select>
                        </CardContent>
                      </Card>

                      <Card className="border-white/8 bg-black/15">
                        <CardContent className="space-y-3 p-4">
                          <div className="text-sm font-medium text-white">Salvar preset global</div>
                          <div className="flex gap-2">
                            <input
                              value={globalPresetName}
                              onChange={(event) => setGlobalPresetName(event.target.value)}
                              placeholder="Nome do preset global"
                              className="h-11 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none"
                            />
                            <Button variant="secondary" onClick={() => savePreset("global")}>
                              <WandSparkles className="h-4 w-4" />
                              Salvar
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {globalPresetOptions.map((preset) => (
                              <Button key={preset.id} variant="ghost" size="sm" onClick={() => applyPreset(preset, "global")}>
                                {preset.name}
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                )}
              </CardContent>
            </Card>

            <Card className="min-h-0 overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-cyan-200" />
                  Biblioteca do editor
                </CardTitle>
                <CardDescription>
                  Selecione fotos para bulk e desative o look global caso uma imagem precise escapar do padrão.
                </CardDescription>
              </CardHeader>
              <CardContent className="scrollbar-none flex min-h-0 flex-col gap-3 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedPhotoIds(photos.map((photo) => photo.id))}>
                    Selecionar todas
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPhotoIds(activeId ? [activeId] : [])}>
                    So ativa
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {photos.map((photo) => {
                    const selected = selectedPhotoIds.includes(photo.id);
                    const active = photo.id === activeId;
                    return (
                      <div key={photo.id} className={`relative overflow-hidden rounded-[20px] border ${active ? "border-cyan-300/40" : "border-white/10"}`}>
                        <button
                          type="button"
                          onClick={() => setActiveId(photo.id)}
                          className="absolute inset-0 z-10"
                          aria-label={`Abrir ${photo.fileName}`}
                        />
                        <img src={photo.url} alt={photo.fileName} loading="lazy" className="aspect-square w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <div className="truncate text-xs text-white">{photo.fileName}</div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleSelection(photo.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white"
                            >
                              {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                              {selected ? "Selecionada" : "Selecionar"}
                            </button>
                            <label className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white">
                              <input
                                type="checkbox"
                                checked={Boolean(photo.disableGlobalLook)}
                                onChange={(event) =>
                                  updatePhotoEdits(photo.id, { disableGlobalLook: event.target.checked })
                                }
                              />
                              Sem look global
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderField({ label, value, min, max, onChange }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-white">{label}</span>
        <span className="font-mono text-xs text-[color:var(--muted-foreground)]">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </div>
  );
}

function UploadCard({ label, onChange }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center">
      <Upload className="mb-2 h-5 w-5 text-cyan-100" />
      <span className="text-sm font-medium text-white">{label}</span>
      <input
        type="file"
        accept={label.includes("LUT") ? ".cube" : ".xmp"}
        className="hidden"
        onChange={onChange}
      />
    </label>
  );
}

function mapXmpToGlobalRecipe(parsedXmp) {
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
