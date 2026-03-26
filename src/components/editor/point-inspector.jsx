import { Crosshair, Move, RotateCcw, Sparkles, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const POINT_LABELS = ["Sup. Esq", "Sup. Dir", "Inf. Dir", "Inf. Esq"];

export function PointInspector({
  activePhoto,
  activePhotoIndex,
  totalPhotos,
  zoom,
  setZoom,
  applyZoomDelta,
  clearPoints,
  selectedPointIndex,
  setSelectedPointIndex,
  moveSelectedPoint,
  hasLocalEdits,
  hasGlobalLook,
  openPostEditor,
}) {
  const points = activePhoto?.points ?? [];

  return (
    <div className="scrollbar-none flex h-full min-h-0 w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-white/10 bg-[rgba(7,12,25,0.72)] p-3 backdrop-blur-2xl lg:max-h-none lg:max-w-[360px] lg:border-l lg:border-t-0 lg:p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Foto ativa</span>
            <Badge variant="accent">
              {activePhotoIndex >= 0 ? `${activePhotoIndex + 1}/${totalPhotos}` : `0/${totalPhotos}`}
            </Badge>
          </CardTitle>
          <CardDescription>
            <span className="block truncate">{activePhoto?.fileName ?? "Selecione uma imagem para editar."}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" className="w-full" onClick={openPostEditor} disabled={!activePhoto}>
            <Sparkles className="h-4 w-4" />
            Abrir editor pos
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Ajuste local</div>
              <div className="mt-2 text-sm font-medium text-white">{hasLocalEdits ? "Ativo" : "Neutro"}</div>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Look global</div>
              <div className="mt-2 text-sm font-medium text-white">{hasGlobalLook ? "Ativo" : "Neutro"}</div>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Zoom</div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-display text-2xl text-white sm:text-3xl">{zoom === 0 ? "FIT" : `${Math.round(zoom * 100)}%`}</div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setZoom(0)}>Auto</Button>
                <Button variant="secondary" size="sm" onClick={() => applyZoomDelta(-1, 1)}>-</Button>
                <Button variant="secondary" size="sm" onClick={() => applyZoomDelta(1, 1)}>+</Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 p-2 text-cyan-100">
                <Target className="h-4 w-4" />
              </div>
              <div className="text-xs text-[color:var(--muted-foreground)]">Pontos marcados</div>
              <div className="mt-1 font-display text-2xl text-white">{points.length}/4</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 p-2 text-cyan-100">
                <Move className="h-4 w-4" />
              </div>
              <div className="text-xs text-[color:var(--muted-foreground)]">Modo de correcao</div>
              <div className="mt-1 text-sm font-medium text-white">
                {selectedPointIndex >= 0 ? `Ponto ${selectedPointIndex + 1}` : "Clique no ponto"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-cyan-200" />
            Ajuste fino
          </CardTitle>
          <CardDescription>Clique ou arraste um ponto no canvas. Depois refine com passos curtos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {POINT_LABELS.map((label, index) => {
              const point = points[index];
              const isSelected = selectedPointIndex === index;

              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => point && setSelectedPointIndex(index)}
                  disabled={!point}
                  className={`rounded-[18px] border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-cyan-300/50 bg-cyan-400/10"
                      : "border-white/10 bg-white/[0.03]"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                    {label}
                  </div>
                  <div className="mt-2 text-sm text-white">
                    {point ? `${Math.round(point.x)} x ${Math.round(point.y)}` : "Aguardando"}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              Nudges
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div />
              <Button variant="secondary" onClick={() => moveSelectedPoint(0, -1)}>↑</Button>
              <div />
              <Button variant="secondary" onClick={() => moveSelectedPoint(-1, 0)}>←</Button>
              <Button variant="secondary" onClick={() => moveSelectedPoint(0, 1)}>↓</Button>
              <Button variant="secondary" onClick={() => moveSelectedPoint(1, 0)}>→</Button>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={clearPoints}>
            <RotateCcw className="h-4 w-4" />
            Limpar pontos da foto ativa
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
