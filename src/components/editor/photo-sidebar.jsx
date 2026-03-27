import { useEffect, useState } from "react";
import {
  Check,
  ChevronsRight,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderTree,
  ImagePlus,
  Trash2,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const INITIAL_VISIBLE_COUNT = 120;
const VISIBLE_COUNT_STEP = 120;

export function PhotoSidebar({
  plateImgData,
  onPlateUpload,
  onFolderSelection,
  onPhotoUpload,
  plateInputRef,
  folderInputRef,
  photoInputRef,
  groupedPhotos,
  photos,
  activeId,
  activePhotoPath,
  expandedFolders,
  toggleFolder,
  expandAllFolders,
  collapseAllFolders,
  setActiveId,
  removePhoto,
  completedCount,
  unsavedCount,
  exportStructuredZip,
  isExporting,
}) {
  const [visibleCounts, setVisibleCounts] = useState({});

  useEffect(() => {
    if (!activeId) return;

    const folderEntry = Object.entries(groupedPhotos).find(([, folderPhotos]) =>
      folderPhotos.some((photo) => photo.id === activeId),
    );
    if (!folderEntry) return;

    const [folderPath, folderPhotos] = folderEntry;
    const activeIndex = folderPhotos.findIndex((photo) => photo.id === activeId);
    const minimumVisibleCount = Math.max(INITIAL_VISIBLE_COUNT, activeIndex + 1);

    setVisibleCounts((current) =>
      current[folderPath] && current[folderPath] >= minimumVisibleCount
        ? current
        : { ...current, [folderPath]: minimumVisibleCount },
    );
  }, [activeId, groupedPhotos]);

  return (
    <aside className="relative z-20 flex h-full min-h-0 w-full shrink-0 flex-col border-b border-white/10 bg-[rgba(6,11,24,0.75)] backdrop-blur-2xl xl:max-w-[380px] xl:border-b-0 xl:border-r">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_58%)]" />

      <div className="flex items-start justify-between gap-4 px-4 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <Badge variant="accent" className="mb-3">
            atelier local
          </Badge>
          <h1 className="font-display text-2xl leading-none text-white sm:text-3xl">Auto Placas</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-[color:var(--muted-foreground)] sm:text-[15px]">
            Estudio visual para aplicar placas com precisao e revisar cada foto antes da exportacao.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, rotate: -8, scale: 0.9 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          className="hidden rounded-full border border-cyan-300/15 bg-cyan-300/10 p-3 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.18)] md:block"
        >
          <ChevronsRight className="h-5 w-5" />
        </motion.div>
      </div>

      <div className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-cyan-200" />
                Template da placa
              </CardTitle>
              <CardDescription>Envie a imagem que sera deformada sobre a placa original.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <button
                type="button"
                onClick={() => plateInputRef.current?.click()}
                className="group flex w-full cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.04]"
              >
                <Upload className="mb-3 h-5 w-5 text-cyan-100 transition group-hover:-translate-y-0.5" />
                <span className="text-sm font-medium text-white">Selecionar template</span>
                <span className="mt-1 text-xs text-[color:var(--muted-foreground)]">PNG, JPG ou JPEG</span>
              </button>
              <input ref={plateInputRef} type="file" accept="image/*" className="hidden" onChange={onPlateUpload} />

              {plateImgData ? (
                <motion.img
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  src={plateImgData}
                  alt="Template da placa"
                  className="h-auto w-full rounded-[24px] border border-white/10 object-cover"
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-cyan-200" />
                Biblioteca de fotos
              </CardTitle>
              <CardDescription>Abra uma pasta inteira ou adicione imagens avulsas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/15"
              >
                <FolderOpen className="h-4 w-4" />
                Abrir pasta mae
              </button>
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory="true"
                directory=""
                multiple
                className="hidden"
                onChange={onFolderSelection}
              />

              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/8"
              >
                <ImagePlus className="h-4 w-4" />
                Upload avulso
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onPhotoUpload} />

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Concluidas</div>
                  <div className="mt-2 font-display text-3xl text-white">{completedCount}</div>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Pendentes</div>
                  <div className="mt-2 font-display text-3xl text-white">{Math.max(photos.length - completedCount, 0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[280px]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-cyan-200" />
                  Estrutura
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={unsavedCount > 0 ? "warning" : "success"}>
                    {completedCount}/{photos.length || 0}
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription>Selecione uma foto para editar ou revisar um arquivo ja finalizado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(groupedPhotos).length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[color:var(--muted-foreground)]">
                  Nenhuma foto carregada ainda.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={expandAllFolders}>
                      Abrir todas
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={collapseAllFolders}>
                      Fechar todas
                    </Button>
                  </div>

                  {Object.entries(groupedPhotos).map(([folderPath, folderPhotos]) => {
                    const visibleCount = Math.min(
                      visibleCounts[folderPath] ?? INITIAL_VISIBLE_COUNT,
                      folderPhotos.length,
                    );
                    const visiblePhotos = folderPhotos.slice(0, visibleCount);
                    const hiddenCount = Math.max(folderPhotos.length - visiblePhotos.length, 0);

                    return (
                      <div
                        key={folderPath}
                        className="space-y-3"
                        style={{ contentVisibility: "auto", containIntrinsicSize: "280px" }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleFolder(folderPath)}
                          className={`flex w-full items-center justify-between rounded-[18px] border px-3 py-2 text-left transition ${
                            activePhotoPath === folderPath
                              ? "border-cyan-300/30 bg-cyan-300/10"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-[color:var(--muted-foreground)]">
                            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-cyan-100" />
                            <span className="truncate">{folderPath}</span>
                          </span>
                          {expandedFolders[folderPath] ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]" />
                          )}
                        </button>

                        {expandedFolders[folderPath] ? (
                          <>
                            <div className="grid grid-cols-3 gap-2">
                              {visiblePhotos.map((photo) => (
                                <div
                                  key={photo.id}
                                  className={`group relative aspect-square overflow-hidden rounded-[18px] border transition-transform duration-150 hover:-translate-y-0.5 hover:scale-[1.01] ${
                                    activeId === photo.id
                                      ? "border-cyan-300/60 shadow-[0_0_0_3px_rgba(34,211,238,0.18)]"
                                      : "border-white/10"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setActiveId(photo.id)}
                                    title={photo.fileName}
                                    className="absolute inset-0 z-10 block h-full w-full"
                                    aria-label={`Abrir ${photo.fileName}`}
                                  />

                                  {photo.thumbUrl ? (
                                    <img
                                      src={photo.thumbUrl}
                                      alt={photo.fileName}
                                      loading="lazy"
                                      decoding="async"
                                      draggable="false"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(15,23,42,0.92))] px-2 text-center text-[11px] font-medium text-cyan-50">
                                      Preparando
                                    </div>
                                  )}

                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                                  {photo.points.length === 4 ? (
                                    <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur">
                                      <Check
                                        className={`h-3.5 w-3.5 ${
                                          photo.saved ? "text-cyan-200" : "text-emerald-300"
                                        }`}
                                      />
                                    </div>
                                  ) : null}

                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      removePhoto(photo.id);
                                    }}
                                    className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-400/20 bg-rose-500/20 text-rose-100 opacity-0 transition group-hover:opacity-100"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {hiddenCount > 0 ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setVisibleCounts((current) => ({
                                      ...current,
                                      [folderPath]: (current[folderPath] ?? INITIAL_VISIBLE_COUNT) + VISIBLE_COUNT_STEP,
                                    }))
                                  }
                                >
                                  Mostrar mais {Math.min(hiddenCount, VISIBLE_COUNT_STEP)}
                                </Button>
                                <div className="text-xs text-[color:var(--muted-foreground)]">
                                  {hiddenCount} miniatura{hiddenCount > 1 ? "s" : ""} fora da tela
                                </div>
                              </div>
                            ) : folderPhotos.length > INITIAL_VISIBLE_COUNT ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setVisibleCounts((current) => ({
                                    ...current,
                                    [folderPath]: INITIAL_VISIBLE_COUNT,
                                  }))
                                }
                              >
                                Mostrar menos
                              </Button>
                            ) : null}
                          </>
                        ) : null}

                        <Separator />
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="px-4 pb-4">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <Button
              className="w-full justify-center rounded-[22px] py-6 text-base"
              onClick={exportStructuredZip}
              disabled={isExporting || unsavedCount === 0 || !plateImgData}
            >
              {isExporting ? "Gerando ZIP..." : `Exportar ZIP estruturado${unsavedCount > 0 ? ` (${unsavedCount})` : ""}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}
