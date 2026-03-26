import {
  Copy,
  Download,
  ImagePlus,
  Layers3,
  Palette,
  Save,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/post-editor/section-card";
import { SliderField } from "@/components/post-editor/slider-field";
import { GLOBAL_CONTROLS, LOCAL_CONTROLS } from "@/components/post-editor/constants";
import { makeLocalEditRecipe } from "@/lib/post-processing";

export function EditorSidebar({
  activePhoto,
  activeLocalRecipe,
  selectedCount,
  localClipboard,
  setLocalClipboard,
  localPresetName,
  setLocalPresetName,
  localPresetOptions,
  globalLookRecipe,
  setGlobalLookRecipe,
  globalPresetName,
  setGlobalPresetName,
  globalPresetOptions,
  customLuts,
  openSections,
  toggleSection,
  setLocalField,
  setGlobalField,
  resetLocalRecipe,
  resetGlobalRecipe,
  savePreset,
  applyPreset,
  applyLocalRecipeToSelected,
  applyGlobalLookToScope,
  updatePhotoEdits,
  schedulePreviewRender,
  commitFullRenderSoon,
  lutInputRef,
  xmpInputRef,
  exportStructuredZip,
}) {
  return (
    <aside className="scrollbar-none flex min-h-0 flex-col overflow-y-auto border-t border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.05),rgba(255,255,255,0.02))] xl:border-l xl:border-t-0">
      <div className="space-y-4 p-4">
        <SectionCard
          title="Foto ativa"
          description="Ajustes tecnicos individuais. Afetam so a foto aberta."
          icon={SlidersHorizontal}
          open={openSections.local}
          onToggle={() => toggleSection("local")}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setLocalClipboard({ ...activeLocalRecipe })}>
              <Copy className="h-4 w-4" />
              Copiar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!localClipboard || !activePhoto) return;
                updatePhotoEdits(activePhoto.id, {
                  localEditRecipe: makeLocalEditRecipe(localClipboard),
                });
                schedulePreviewRender("full");
              }}
              disabled={!localClipboard || !activePhoto}
            >
              Colar
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
              Resetar
            </Button>
          </div>

          <div className="space-y-3">
            {LOCAL_CONTROLS.map(([field, label, min, max]) => (
              <SliderField
                key={field}
                label={label}
                value={activeLocalRecipe[field]}
                min={min}
                max={max}
                onChange={(value) => setLocalField(field, value)}
                onCommit={commitFullRenderSoon}
              />
            ))}
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
            <div className="mb-3 text-sm font-medium text-white">Preset local</div>
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
            <div className="mt-3 flex flex-wrap gap-2">
              {localPresetOptions.map((preset) => (
                <Button key={preset.id} variant="ghost" size="sm" onClick={() => applyPreset(preset, "local")}>
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Look do lote"
          description="Cor e identidade visual global. Pode ser ligado nas selecionadas ou em todas."
          icon={Palette}
          open={openSections.global}
          onToggle={() => toggleSection("global")}
        >
          <div className="space-y-3">
            {GLOBAL_CONTROLS.map(([field, label, min, max]) => (
              <SliderField
                key={field}
                label={label}
                value={globalLookRecipe[field]}
                min={min}
                max={max}
                onChange={(value) => setGlobalField(field, value)}
                onCommit={commitFullRenderSoon}
              />
            ))}
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
            <div className="mb-2 text-sm font-medium text-white">LUT ativa</div>
            <select
              value={globalLookRecipe.lutId ?? ""}
              onChange={(event) => {
                setGlobalLookRecipe((current) => ({ ...current, lutId: event.target.value || null }));
                schedulePreviewRender("full");
              }}
              className="h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none"
            >
              <option value="">Sem LUT</option>
              {customLuts.map((lut) => (
                <option key={lut.id} value={lut.id}>
                  {lut.name}
                </option>
              ))}
            </select>
          </div>
        </SectionCard>

        <SectionCard
          title="LUTs e presets"
          description="Importe filtros e mantenha seus looks salvos na sessao."
          icon={WandSparkles}
          open={openSections.assets}
          onToggle={() => toggleSection("assets")}
        >
          <div className="grid gap-3">
            <Button variant="secondary" className="w-full justify-between" onClick={() => lutInputRef.current?.click()}>
              <span className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Importar LUT .cube
              </span>
              <span className="text-xs text-[color:var(--muted-foreground)]">Filtro de cor</span>
            </Button>
            <Button variant="secondary" className="w-full justify-between" onClick={() => xmpInputRef.current?.click()}>
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Importar preset XMP
              </span>
              <span className="text-xs text-[color:var(--muted-foreground)]">Subset Lightroom</span>
            </Button>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
            <div className="mb-3 text-sm font-medium text-white">Preset global</div>
            <div className="flex gap-2">
              <input
                value={globalPresetName}
                onChange={(event) => setGlobalPresetName(event.target.value)}
                placeholder="Nome do preset global"
                className="h-11 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none"
              />
              <Button variant="secondary" onClick={() => savePreset("global")}>
                <Save className="h-4 w-4" />
                Salvar
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {globalPresetOptions.map((preset) => (
                <Button key={preset.id} variant="ghost" size="sm" onClick={() => applyPreset(preset, "global")}>
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Aplicar e exportar"
          description="Acoes de lote concentradas em um unico lugar."
          icon={Layers3}
          open={openSections.actions}
          onToggle={() => toggleSection("actions")}
        >
          <div className="grid gap-2">
            <Button variant="secondary" onClick={() => applyGlobalLookToScope("selected")}>
              Aplicar look global nas selecionadas
            </Button>
            <Button variant="secondary" onClick={() => applyGlobalLookToScope("all")}>
              Aplicar look global em todas
            </Button>
            <Button variant="outline" onClick={resetGlobalRecipe}>
              Resetar look global
            </Button>
            <Button variant="default" onClick={exportStructuredZip}>
              <Download className="h-4 w-4" />
              Exportar tudo
            </Button>
          </div>
        </SectionCard>
      </div>
    </aside>
  );
}
