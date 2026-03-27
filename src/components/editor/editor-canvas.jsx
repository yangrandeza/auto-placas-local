import { ChevronLeft, ChevronRight, Grip, Hand, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EditorCanvas({
  photos,
  activePhoto,
  activePhotoIndex,
  navigatePhoto,
  mousePos,
  activeDim,
  resolvedZoom,
  viewportSize,
  canvasRef,
  previewCanvasRef,
  canvasScrollRef,
  lupaCanvasRef,
  handleCanvasClick,
  handleCanvasPointerDown,
  handleCanvasPointerMove,
  handleCanvasPointerUp,
  setMousePos,
  selectedPointIndex,
  isSpaceDown,
  isPanning,
  showLoupe,
}) {
  if (photos.length === 0) {
    return (
      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(34,211,238,0.12),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(251,191,36,0.08),transparent_28%)]" />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mx-4 max-w-xl rounded-[40px] border border-white/10 bg-white/[0.04] p-6 text-center shadow-[0_30px_120px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-10"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="font-display text-3xl leading-none text-white sm:text-5xl">Carregue sua primeira cena</h2>
          <p className="mt-4 text-sm text-[color:var(--muted-foreground)] sm:text-base">
            A mesa de edicao aparece aqui com zoom, lupa e correcao fina dos pontos.
          </p>
        </motion.div>
      </main>
    );
  }

  const canvasWidth = Math.max(activeDim.w * resolvedZoom, 1);
  const canvasHeight = Math.max(activeDim.h * resolvedZoom, 1);
  const stageWidth = Math.max(canvasWidth, viewportSize.width || 0);
  const stageHeight = Math.max(canvasHeight, viewportSize.height || 0);
  const offsetX = canvasWidth < stageWidth ? (stageWidth - canvasWidth) / 2 : 0;
  const offsetY = canvasHeight < stageHeight ? (stageHeight - canvasHeight) / 2 : 0;

  return (
    <main className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_80%_100%,rgba(251,191,36,0.08),transparent_22%)]" />

      <div className="relative z-10 flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="truncate font-display text-xl leading-none text-white sm:text-2xl">{activePhoto?.fileName}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)] sm:text-sm">
              <Badge variant="default">Foto {activePhotoIndex + 1} de {photos.length}</Badge>
              <span>Ctrl + scroll para zoom, espaco + arraste para navegar.</span>
              {isSpaceDown ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-amber-100">
                  <Hand className="h-3.5 w-3.5" />
                  Pan ativo
                </span>
              ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <Button variant="secondary" size="icon" onClick={() => navigatePhoto("prev")} disabled={activePhotoIndex <= 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => navigatePhoto("next")} disabled={activePhotoIndex >= photos.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence>
          {showLoupe ? (
            <motion.div
              key="loupe"
              initial={{ opacity: 0, y: -8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="pointer-events-none absolute right-3 top-3 z-20 hidden overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(7,12,25,0.88)] shadow-[0_26px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl lg:block"
            >
              <div className="border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                Lupa de precisao
              </div>
              <canvas ref={lupaCanvasRef} width={160} height={160} className="block" />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {activePhoto?.points.length < 4 ? (
            <motion.div
              key="guide"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-none absolute left-1/2 top-3 z-10 w-[calc(100%-1.5rem)] max-w-max -translate-x-1/2 sm:top-6 sm:w-auto"
            >
              <Card className="rounded-[24px] px-4 py-3 sm:rounded-full sm:px-5">
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white sm:text-sm">
                  <Grip className="h-4 w-4 text-cyan-100" />
                  <span>1. Sup. Esq</span>
                  <span className="text-white/30">/</span>
                  <span>2. Sup. Dir</span>
                  <span className="text-white/30">/</span>
                  <span>3. Inf. Dir</span>
                  <span className="text-white/30">/</span>
                  <span>4. Inf. Esq</span>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div ref={canvasScrollRef} className="scrollbar-none relative h-full overflow-auto p-3 sm:p-6">
          <div
            className="relative"
            style={{
              width: `${stageWidth}px`,
              height: `${stageHeight}px`,
            }}
          >
            <div
              className="absolute overflow-hidden rounded-[20px] border border-white/10 bg-black/30 shadow-[0_40px_140px_rgba(0,0,0,0.4)] sm:rounded-[28px]"
              style={{
                left: `${offsetX}px`,
                top: `${offsetY}px`,
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
              }}
            >
              <canvas ref={canvasRef} className="pointer-events-none block h-full w-full" />
              <canvas
                ref={previewCanvasRef}
                className={`absolute inset-0 block h-full w-full ${
                  isSpaceDown || isPanning
                    ? "cursor-grab"
                    : selectedPointIndex >= 0
                      ? "cursor-grab active:cursor-grabbing"
                      : "cursor-crosshair"
                }`}
                onClick={handleCanvasClick}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
