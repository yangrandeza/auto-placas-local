export function PreviewStage({ activePhoto, previewCanvasRef, previewViewportRef, previewStatus }) {
  return (
    <div ref={previewViewportRef} className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.06),transparent_22%)]" />
      <div className="relative flex min-h-full items-center justify-center">
        <div className="w-full max-w-[min(90vw,1400px)] overflow-hidden rounded-[30px] border border-white/10 bg-[rgba(2,6,23,0.88)] p-4 shadow-[0_35px_120px_rgba(0,0,0,0.38)] sm:p-5">
          {activePhoto ? (
            <div className="relative">
              <canvas ref={previewCanvasRef} className="block max-h-[72vh] w-full rounded-[24px] object-contain" />
              <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-white">
                {previewStatus === "rendering" ? "Aplicando ajustes..." : "Preview ao vivo"}
              </div>
            </div>
          ) : (
            <div className="grid h-[420px] place-items-center rounded-[22px] border border-dashed border-white/10 text-sm text-[color:var(--muted-foreground)]">
              Selecione uma foto para editar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
