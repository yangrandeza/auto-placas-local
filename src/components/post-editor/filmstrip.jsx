import { CheckSquare, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MiniPill } from "@/components/post-editor/mini-pill";
import { DEFAULT_LOCAL_EDIT_RECIPE } from "@/lib/post-processing";

export function Filmstrip({
  photos,
  activeId,
  selectedPhotoIds,
  setSelectedPhotoIds,
  onThumbnailClick,
  filmstripItemRefs,
}) {
  return (
    <footer className="border-t border-white/10 bg-[rgba(3,7,18,0.94)] px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Filmstrip</div>
          <div className="mt-1 text-sm text-white">Clique para navegar. `Ctrl/Cmd` alterna selecao e `Shift` seleciona intervalo.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSelectedPhotoIds(photos.map((photo) => photo.id))}>
            Selecionar todas
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedPhotoIds(activeId ? [activeId] : [])}>
            So ativa
          </Button>
        </div>
      </div>

      <div className="scrollbar-none flex gap-3 overflow-x-auto pb-1">
        {photos.map((photo, index) => {
          const isActive = photo.id === activeId;
          const isSelected = selectedPhotoIds.includes(photo.id);
          const hasLocalEdits =
            JSON.stringify(photo.localEditRecipe ?? DEFAULT_LOCAL_EDIT_RECIPE) !==
            JSON.stringify(DEFAULT_LOCAL_EDIT_RECIPE);

          return (
            <button
              key={photo.id}
              type="button"
              ref={(element) => {
                if (element) filmstripItemRefs.current.set(photo.id, element);
                else filmstripItemRefs.current.delete(photo.id);
              }}
              onClick={(event) => onThumbnailClick(photo, event)}
              className={`group relative w-40 shrink-0 overflow-hidden rounded-[22px] border text-left transition ${
                isActive
                  ? "border-cyan-300/40 bg-cyan-400/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
            >
              <img src={photo.url} alt={photo.fileName} loading="lazy" className="h-24 w-full object-cover" />
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{photo.fileName}</div>
                    <div className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">#{index + 1}</div>
                  </div>
                  {isSelected ? <CheckSquare className="h-4 w-4 text-cyan-200" /> : <Square className="h-4 w-4 text-white/45" />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hasLocalEdits ? <MiniPill label="Local" tone="cyan" /> : null}
                  {!photo.disableGlobalLook ? <MiniPill label="Look" tone="amber" /> : <MiniPill label="Sem look" tone="slate" />}
                  {photo.saved ? <MiniPill label="Exportada" tone="green" /> : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </footer>
  );
}
