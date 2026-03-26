import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, Layers3, Palette, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SECTION_DEFAULTS } from "@/components/post-editor/constants";
import { EditorSidebar } from "@/components/post-editor/editor-sidebar";
import { Filmstrip } from "@/components/post-editor/filmstrip";
import { mapXmpToGlobalRecipe } from "@/components/post-editor/helpers";
import { PreviewStage } from "@/components/post-editor/preview-stage";
import {
  DEFAULT_LOCAL_EDIT_RECIPE,
  makeGlobalLookRecipe,
  makeLocalEditRecipe,
  parseCubeLut,
  renderPhotoToCanvas,
} from "@/lib/post-processing";

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
  plateImgObj,
  globalLut,
  updatePhotoEdits,
  applyLocalRecipeToSelected,
  applyGlobalLookToScope,
  exportStructuredZip,
  showFeedback,
  closeEditor,
}) {
  const [localPresetName, setLocalPresetName] = useState("");
  const [globalPresetName, setGlobalPresetName] = useState("");
  const [openSections, setOpenSections] = useState(SECTION_DEFAULTS);
  const [previewQuality, setPreviewQuality] = useState("full");
  const [previewStatus, setPreviewStatus] = useState("idle");

  const lutInputRef = useRef(null);
  const xmpInputRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const previewViewportRef = useRef(null);
  const previewFrameRef = useRef(0);
  const fullRenderTimeoutRef = useRef(0);
  const imageCacheRef = useRef(new Map());
  const filmstripItemRefs = useRef(new Map());
  const selectionAnchorIdRef = useRef(null);

  const activeLocalRecipe = activePhoto?.localEditRecipe ?? DEFAULT_LOCAL_EDIT_RECIPE;
  const selectedCount = selectedPhotoIds.length;
  const deferredPhotos = useDeferredValue(photos);

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
    selectionAnchorIdRef.current = activeId;
  }, [activeId, selectedPhotoIds.length, setSelectedPhotoIds]);

  useEffect(() => {
    const element = filmstripItemRefs.current.get(activeId);
    element?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeId, deferredPhotos]);

  useEffect(
    () => () => {
      window.cancelAnimationFrame(previewFrameRef.current);
      window.clearTimeout(fullRenderTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    schedulePreviewRender("full");
  }, [activePhoto, globalLookRecipe, globalLut, plateImgObj]);

  const toggleSection = (section) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const ensureImage = async (photo) => {
    if (!photo) return null;
    const cached = imageCacheRef.current.get(photo.id);
    if (cached) return cached;

    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = reject;
      nextImage.src = photo.url;
    });

    imageCacheRef.current.set(photo.id, image);
    return image;
  };

  const schedulePreviewRender = (quality) => {
    window.cancelAnimationFrame(previewFrameRef.current);
    window.clearTimeout(fullRenderTimeoutRef.current);
    setPreviewQuality(quality);

    previewFrameRef.current = window.requestAnimationFrame(async () => {
      if (!activePhoto || !previewCanvasRef.current) return;
      setPreviewStatus("rendering");

      try {
        const sourceImage = await ensureImage(activePhoto);
        if (!sourceImage || !previewCanvasRef.current) return;

        const viewport = previewViewportRef.current;
        const maxDimension =
          quality === "draft"
            ? 1400
            : Math.max(
                viewport?.clientWidth ?? 0,
                viewport?.clientHeight ?? 0,
                sourceImage.width,
                sourceImage.height,
              );

        renderPhotoToCanvas({
          canvas: previewCanvasRef.current,
          sourceImage,
          plateImage: plateImgObj,
          photo: activePhoto,
          globalRecipe: globalLookRecipe,
          lut: globalLut,
          maxDimension,
        });

        setPreviewStatus("ready");
      } catch {
        setPreviewStatus("error");
      }
    });
  };

  const commitFullRenderSoon = () => {
    window.clearTimeout(fullRenderTimeoutRef.current);
    fullRenderTimeoutRef.current = window.setTimeout(() => schedulePreviewRender("full"), 90);
  };

  const setLocalField = (field, value) => {
    if (!activePhoto) return;
    updatePhotoEdits(activePhoto.id, {
      localEditRecipe: {
        ...activeLocalRecipe,
        [field]: value,
      },
    });
    schedulePreviewRender("draft");
  };

  const setGlobalField = (field, value) => {
    setGlobalLookRecipe((current) => ({ ...current, [field]: value }));
    schedulePreviewRender("draft");
  };

  const resetLocalRecipe = () => {
    if (!activePhoto) return;
    updatePhotoEdits(activePhoto.id, { localEditRecipe: makeLocalEditRecipe() });
    schedulePreviewRender("full");
  };

  const resetGlobalRecipe = () => {
    setGlobalLookRecipe(makeGlobalLookRecipe());
    schedulePreviewRender("full");
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
      updatePhotoEdits(activePhoto.id, {
        localEditRecipe: makeLocalEditRecipe(preset.recipe),
      });
      schedulePreviewRender("full");
      return;
    }

    if (scope === "global") {
      setGlobalLookRecipe(makeGlobalLookRecipe(preset.recipe));
      schedulePreviewRender("full");
    }
  };

  const importCube = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lut = parseCubeLut(text);
      setCustomLuts((current) => [...current, lut]);
      setGlobalLookRecipe((current) => ({ ...current, lutId: lut.id }));
      schedulePreviewRender("full");
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
      schedulePreviewRender("full");
      showFeedback("success", "Preset XMP importado com subset suportado.");
    } catch {
      showFeedback("error", "Nao foi possivel ler esse preset XMP.");
    } finally {
      event.target.value = "";
    }
  };

  const handleThumbnailClick = (photo, event) => {
    const targetIndex = deferredPhotos.findIndex((item) => item.id === photo.id);

    if (event.shiftKey && selectionAnchorIdRef.current) {
      const anchorIndex = deferredPhotos.findIndex((item) => item.id === selectionAnchorIdRef.current);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = [anchorIndex, targetIndex].sort((a, b) => a - b);
        setSelectedPhotoIds(deferredPhotos.slice(start, end + 1).map((item) => item.id));
      }
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedPhotoIds((current) =>
        current.includes(photo.id)
          ? current.filter((id) => id !== photo.id)
          : [...current, photo.id],
      );
      selectionAnchorIdRef.current = photo.id;
    } else {
      setSelectedPhotoIds([photo.id]);
      selectionAnchorIdRef.current = photo.id;
    }

    setActiveId(photo.id);
  };

  const toggleDisableGlobalLook = (photoId, checked) => {
    updatePhotoEdits(photoId, { disableGlobalLook: checked });
    schedulePreviewRender("full");
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[rgba(2,6,23,0.8)] backdrop-blur-md">
      <div className="absolute inset-3 overflow-hidden rounded-[34px] border border-white/10 bg-[rgba(4,9,20,0.98)] shadow-[0_30px_120px_rgba(0,0,0,0.5)]">
        <div className="flex h-full min-h-0 flex-col">
          <header className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(34,211,238,0.08),rgba(251,191,36,0.06),transparent)] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent">editor pos</Badge>
                  <Badge variant="default">{selectedCount} selecionada(s)</Badge>
                  <Badge variant="default">{previewQuality === "draft" ? "preview rapido" : "preview completo"}</Badge>
                </div>
                <h2 className="mt-3 font-display text-3xl leading-none text-white">MicroLightroom</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                  Correcao individual da foto ativa, look global do lote e navegacao rapida no filmstrip inferior.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => lutInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" />
                  Importar LUT .cube
                </Button>
                <Button variant="secondary" onClick={() => xmpInputRef.current?.click()}>
                  <Sparkles className="h-4 w-4" />
                  Importar preset XMP
                </Button>
                <Button variant="secondary" onClick={() => applyGlobalLookToScope("selected")}>
                  <Layers3 className="h-4 w-4" />
                  Look na selecao
                </Button>
                <Button variant="secondary" onClick={() => applyGlobalLookToScope("all")}>
                  <Palette className="h-4 w-4" />
                  Look em todas
                </Button>
                <Button variant="default" onClick={exportStructuredZip}>
                  <Download className="h-4 w-4" />
                  Exportar lote
                </Button>
                <Button variant="ghost" size="icon" onClick={closeEditor}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <input ref={lutInputRef} type="file" accept=".cube" className="hidden" onChange={importCube} />
            <input ref={xmpInputRef} type="file" accept=".xmp" className="hidden" onChange={importXmp} />
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
            <main className="flex min-h-0 flex-col overflow-hidden">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Foto ativa</div>
                    <div className="mt-1 truncate font-display text-2xl text-white">
                      {activePhoto?.fileName ?? "Nenhuma foto ativa"}
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={Boolean(activePhoto?.disableGlobalLook)}
                      onChange={(event) => activePhoto && toggleDisableGlobalLook(activePhoto.id, event.target.checked)}
                    />
                    Ignorar look global nesta foto
                  </label>
                </div>
              </div>

              <PreviewStage
                activePhoto={activePhoto}
                previewCanvasRef={previewCanvasRef}
                previewViewportRef={previewViewportRef}
                previewStatus={previewStatus}
              />

              <Filmstrip
                photos={deferredPhotos}
                activeId={activeId}
                selectedPhotoIds={selectedPhotoIds}
                setSelectedPhotoIds={setSelectedPhotoIds}
                onThumbnailClick={handleThumbnailClick}
                filmstripItemRefs={filmstripItemRefs}
              />
            </main>

            <EditorSidebar
              activePhoto={activePhoto}
              activeLocalRecipe={activeLocalRecipe}
              selectedCount={selectedCount}
              localClipboard={localClipboard}
              setLocalClipboard={setLocalClipboard}
              localPresetName={localPresetName}
              setLocalPresetName={setLocalPresetName}
              localPresetOptions={localPresetOptions}
              globalLookRecipe={globalLookRecipe}
              setGlobalLookRecipe={setGlobalLookRecipe}
              globalPresetName={globalPresetName}
              setGlobalPresetName={setGlobalPresetName}
              globalPresetOptions={globalPresetOptions}
              customLuts={customLuts}
              openSections={openSections}
              toggleSection={toggleSection}
              setLocalField={setLocalField}
              setGlobalField={setGlobalField}
              resetLocalRecipe={resetLocalRecipe}
              resetGlobalRecipe={resetGlobalRecipe}
              savePreset={savePreset}
              applyPreset={applyPreset}
              applyLocalRecipeToSelected={applyLocalRecipeToSelected}
              applyGlobalLookToScope={applyGlobalLookToScope}
              updatePhotoEdits={updatePhotoEdits}
              schedulePreviewRender={schedulePreviewRender}
              commitFullRenderSoon={commitFullRenderSoon}
              lutInputRef={lutInputRef}
              xmpInputRef={xmpInputRef}
              exportStructuredZip={exportStructuredZip}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
