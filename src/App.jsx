import { Suspense, lazy, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { AlertCircle, CheckCircle2, LoaderCircle, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { EditorCanvas } from "@/components/editor/editor-canvas";
import { PhotoSidebar } from "@/components/editor/photo-sidebar";
import { PointInspector } from "@/components/editor/point-inspector";
import {
  IMAGE_REGEX,
  clamp,
  createPhotoRecord,
  drawWarpedPlate,
  findNearestPointIndex,
  revokePhotoUrls,
} from "@/lib/utils";
import {
  applyRecipeToImageData,
  DEFAULT_GLOBAL_LOOK_RECIPE,
  DEFAULT_LOCAL_EDIT_RECIPE,
  hasMeaningfulAdjustments,
  makeGlobalLookRecipe,
  makeLocalEditRecipe,
} from "@/lib/post-processing";

const PostEditorModule = lazy(() => import("@/components/post-editor/module.jsx"));

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [plateImgData, setPlateImgData] = useState(null);
  const [plateImgObj, setPlateImgObj] = useState(null);
  const [activeImageObj, setActiveImageObj] = useState(null);
  const [activeDim, setActiveDim] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(0);
  const [mousePos, setMousePos] = useState(null);
  const [isShiftDown, setIsShiftDown] = useState(false);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState(-1);
  const [draggingPointIndex, setDraggingPointIndex] = useState(-1);
  const [isPanning, setIsPanning] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [globalLookRecipe, setGlobalLookRecipe] = useState(makeGlobalLookRecipe());
  const [customLuts, setCustomLuts] = useState([]);
  const [customPresets, setCustomPresets] = useState([]);
  const [localClipboard, setLocalClipboard] = useState(null);

  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const lupaCanvasRef = useRef(null);
  const photosRef = useRef([]);
  const plateInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const canvasScrollRef = useRef(null);
  const panStateRef = useRef({ pointerX: 0, pointerY: 0, scrollLeft: 0, scrollTop: 0 });

  const activePhoto = photos.find((photo) => photo.id === activeId) ?? null;
  const deferredPhotos = useDeferredValue(photos);
  const activePhotoIndex = photos.findIndex((photo) => photo.id === activeId);
  const completedCount = photos.filter((photo) => photo.points.length === 4).length;
  const unsavedCount = photos.filter((photo) => photo.points.length === 4 && !photo.saved).length;
  const activeLut = customLuts.find((lut) => lut.id === globalLookRecipe.lutId) ?? null;
  const activeHasLocalEdits = hasMeaningfulAdjustments(activePhoto?.localEditRecipe, DEFAULT_LOCAL_EDIT_RECIPE);
  const activeHasGlobalLook = hasMeaningfulAdjustments(globalLookRecipe, DEFAULT_GLOBAL_LOOK_RECIPE) || Boolean(activeLut);

  const groupedPhotos = useMemo(
    () =>
      deferredPhotos.reduce((acc, photo) => {
        if (!acc[photo.path]) acc[photo.path] = [];
        acc[photo.path].push(photo);
        return acc;
      }, {}),
    [deferredPhotos],
  );

  useEffect(() => {
    if (!activePhoto?.path) return;
    setExpandedFolders((current) => (current[activePhoto.path] ? current : { ...current, [activePhoto.path]: true }));
  }, [activePhoto?.path]);

  const getFitZoom = () => {
    if (!canvasRef.current || activeDim.w <= 0) return 1;
    return canvasRef.current.getBoundingClientRect().width / activeDim.w;
  };

  const resolveZoomValue = (value) => (value === 0 ? getFitZoom() : value);

  const applyZoomDelta = (direction, intensity = 1) => {
    setZoom((current) => {
      const baseZoom = resolveZoomValue(current);
      const factor = Math.pow(1.035, intensity * direction);
      const nextZoom = clamp(baseZoom * factor, 0.08, 8);
      return Math.abs(nextZoom - getFitZoom()) < 0.015 ? 0 : nextZoom;
    });
  };

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
  };

  useEffect(() => {
    if (!feedback) return undefined;
    const timeoutId = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Shift") setIsShiftDown(true);
      if (event.code === "Space" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")) {
        event.preventDefault();
        setIsSpaceDown(true);
      }
      if (selectedPointIndex >= 0 && activePhoto?.points[selectedPointIndex]) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveSelectedPoint(0, -1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveSelectedPoint(0, 1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveSelectedPoint(-1, 0);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveSelectedPoint(1, 0);
        }
      }
    };

    const onKeyUp = (event) => {
      if (event.key === "Shift") setIsShiftDown(false);
      if (event.code === "Space") {
        setIsSpaceDown(false);
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedPointIndex, activePhoto]);

  useEffect(() => {
    const container = canvasScrollRef.current;
    if (!container) return undefined;

    const handleWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const intensity = clamp(Math.abs(event.deltaY) / 220, 0.2, 0.55);
      applyZoomDelta(direction, intensity);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [activeDim.w, zoom]);

  useEffect(() => {
    if (!plateImgData) {
      setPlateImgObj(null);
      return;
    }

    const img = new Image();
    img.onload = () => setPlateImgObj(img);
    img.src = plateImgData;
  }, [plateImgData]);

  useEffect(() => {
    if (!activePhoto) {
      setActiveImageObj(null);
      setActiveDim({ w: 0, h: 0 });
      setSelectedPointIndex(-1);
      return;
    }

    const img = new Image();
    img.onload = () => {
      setActiveImageObj(img);
      setActiveDim({ w: img.width, h: img.height });
      setZoom(0);
    };
    img.src = activePhoto.url;
  }, [activePhoto]);

  useEffect(() => {
    if (selectedPointIndex >= (activePhoto?.points.length ?? 0)) {
      setSelectedPointIndex(-1);
    }
  }, [activePhoto, selectedPointIndex]);

  useEffect(() => {
    if (!activeImageObj || !canvasRef.current || !previewCanvasRef.current || !activePhoto) return;

    const canvas = canvasRef.current;
    const preview = previewCanvasRef.current;
    if (canvas.width !== activeImageObj.width || canvas.height !== activeImageObj.height) {
      canvas.width = activeImageObj.width;
      canvas.height = activeImageObj.height;
      preview.width = activeImageObj.width;
      preview.height = activeImageObj.height;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(activeImageObj, 0, 0);

    if (activePhoto.points.length === 4 && plateImgObj) {
      drawWarpedPlate(ctx, plateImgObj, activePhoto.points);
    }

    applyPostEditsToCanvas(canvas, activePhoto);
  }, [activeImageObj, activePhoto, plateImgObj, globalLookRecipe, activeLut]);

  useEffect(() => {
    if (!previewCanvasRef.current || !activeImageObj || !activePhoto) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const points = activePhoto.points;
    if (points.length > 0) {
      ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
      ctx.lineWidth = Math.max(2, width / 520);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(points[index].x, points[index].y);
      }
      if (points.length === 4) ctx.closePath();
      ctx.stroke();
    }

    if (points.length > 0 && points.length < 4 && mousePos) {
      const last = points.at(-1);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
      ctx.setLineDash([Math.max(8, width / 240), Math.max(8, width / 240)]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    points.forEach((point, index) => {
      const radius = index === selectedPointIndex ? Math.max(10, width / 180) : Math.max(8, width / 260);
      const fontSize = Math.max(15, width / 95);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = index === selectedPointIndex ? "#f59e0b" : "#06b6d4";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = Math.max(1.25, width / 1200);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${fontSize}px "IBM Plex Sans", sans-serif`;
      ctx.fillText(String(index + 1), point.x + fontSize * 0.8, point.y - fontSize * 0.6);
    });
  }, [activeImageObj, activePhoto, mousePos, selectedPointIndex]);

  useEffect(() => {
    if (!mousePos || !lupaCanvasRef.current || !canvasRef.current || !previewCanvasRef.current) return;

    const lupaCtx = lupaCanvasRef.current.getContext("2d");
    const size = 160;
    const source = 36;

    lupaCtx.imageSmoothingEnabled = false;
    lupaCtx.clearRect(0, 0, size, size);
    lupaCtx.drawImage(
      canvasRef.current,
      mousePos.x - source / 2,
      mousePos.y - source / 2,
      source,
      source,
      0,
      0,
      size,
      size,
    );
    lupaCtx.drawImage(
      previewCanvasRef.current,
      mousePos.x - source / 2,
      mousePos.y - source / 2,
      source,
      source,
      0,
      0,
      size,
      size,
    );
    lupaCtx.strokeStyle = "#f59e0b";
    lupaCtx.lineWidth = 1.5;
    lupaCtx.beginPath();
    lupaCtx.moveTo(size / 2, 0);
    lupaCtx.lineTo(size / 2, size);
    lupaCtx.moveTo(0, size / 2);
    lupaCtx.lineTo(size, size / 2);
    lupaCtx.stroke();
  }, [mousePos, activePhoto, selectedPointIndex]);

  useEffect(
    () => () => {
      revokePhotoUrls(photosRef.current);
    },
    [],
  );

  const updateActivePhoto = (updater) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === activeId ? updater(photo) : photo,
      ),
    );
  };

  const getCanvasCoords = (event) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const constrainPointToCanvas = (point) => ({
    x: clamp(point.x, 0, activeDim.w),
    y: clamp(point.y, 0, activeDim.h),
  });

  const getSnappedPoint = (rawPoint, points) => {
    if (!isShiftDown || points.length === 0 || draggingPointIndex >= 0) return rawPoint;
    const last = points.at(-1);
    const dx = rawPoint.x - last.x;
    const dy = rawPoint.y - last.y;
    const angle = Math.atan2(dy, dx);
    const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const distance = Math.hypot(dx, dy);
    return {
      x: last.x + Math.cos(snappedAngle) * distance,
      y: last.y + Math.sin(snappedAngle) * distance,
    };
  };

  const moveSelectedPoint = (dx, dy) => {
    if (!activePhoto || selectedPointIndex < 0 || !activePhoto.points[selectedPointIndex]) return;
    updateActivePhoto((photo) => ({
      ...photo,
      saved: false,
      points: photo.points.map((point, index) =>
        index === selectedPointIndex
          ? constrainPointToCanvas({ x: point.x + dx, y: point.y + dy })
          : point,
      ),
    }));
  };

  const appendPhotos = (files, folderMode) => {
    const imageFiles = files.filter((file) => IMAGE_REGEX.test(file.name));
    if (imageFiles.length === 0) {
      setFeedback({ type: "info", message: "Nenhuma imagem valida foi encontrada nesse lote." });
      return;
    }

    const newPhotos = imageFiles.map((file) => ({
      ...createPhotoRecord(file, folderMode),
      localEditRecipe: makeLocalEditRecipe(),
      disableGlobalLook: false,
    }));
    setPhotos((current) => {
      const updated = [...current, ...newPhotos];
      if (current.length === 0 && updated.length > 0) {
        setActiveId(updated[0].id);
        setSelectedPhotoIds([updated[0].id]);
      }
      return updated;
    });
    setFeedback({
      type: "success",
      message: `${imageFiles.length} imagem${imageFiles.length > 1 ? "ns" : ""} adicionada${imageFiles.length > 1 ? "s" : ""}.`,
    });
  };

  const handlePlateUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => setPlateImgData(loadEvent.target?.result ?? null);
    reader.readAsDataURL(file);
  };

  const handleFolderSelection = (event) => {
    appendPhotos(Array.from(event.target.files ?? []), true);
    event.target.value = "";
  };

  const handlePhotoUpload = (event) => {
    appendPhotos(Array.from(event.target.files ?? []), false);
    event.target.value = "";
  };

  const clearPoints = () => {
    if (!activePhoto) return;
    setSelectedPointIndex(-1);
    updateActivePhoto((photo) => ({ ...photo, points: [], saved: false }));
  };

  const removePhoto = (id) => {
    setSelectedPhotoIds((current) => current.filter((photoId) => photoId !== id));
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.url);
      const updated = current.filter((photo) => photo.id !== id);
      if (activeId === id) {
        setActiveId(updated[0]?.id ?? null);
        setSelectedPointIndex(-1);
      }
      return updated;
    });
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderPath]: !current[folderPath],
    }));
  };

  const setAllFoldersExpanded = (expanded) => {
    const nextState = {};
    Object.keys(groupedPhotos).forEach((folderPath) => {
      nextState[folderPath] = expanded;
    });
    setExpandedFolders(nextState);
  };

  const handleCanvasClick = (event) => {
    if (!activePhoto || draggingPointIndex >= 0 || isSpaceDown || isPanning) return;

    const rawPoint = constrainPointToCanvas(getCanvasCoords(event));
    const nearestIndex = findNearestPointIndex(
      activePhoto.points,
      rawPoint,
      Math.max(18, activeDim.w / 55),
    );

    if (nearestIndex >= 0) {
      setSelectedPointIndex(nearestIndex);
      return;
    }

    if (activePhoto.points.length >= 4) return;

    const snapped = constrainPointToCanvas(getSnappedPoint(rawPoint, activePhoto.points));
    updateActivePhoto((photo) => ({
      ...photo,
      saved: false,
      points: [...photo.points, snapped],
    }));
    setSelectedPointIndex(activePhoto.points.length);
  };

  const handleCanvasPointerDown = (event) => {
    if (!activePhoto) return;

    if (isSpaceDown && canvasScrollRef.current) {
      panStateRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        scrollLeft: canvasScrollRef.current.scrollLeft,
        scrollTop: canvasScrollRef.current.scrollTop,
      };
      setIsPanning(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }

    const point = constrainPointToCanvas(getCanvasCoords(event));
    const nearestIndex = findNearestPointIndex(
      activePhoto.points,
      point,
      Math.max(20, activeDim.w / 48),
    );

    if (nearestIndex >= 0) {
      setSelectedPointIndex(nearestIndex);
      setDraggingPointIndex(nearestIndex);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
  };

  const handleCanvasPointerMove = (event) => {
    if (!activePhoto) return;

    if (isPanning && canvasScrollRef.current) {
      const { pointerX, pointerY, scrollLeft, scrollTop } = panStateRef.current;
      canvasScrollRef.current.scrollLeft = scrollLeft - (event.clientX - pointerX);
      canvasScrollRef.current.scrollTop = scrollTop - (event.clientY - pointerY);
      return;
    }

    const point = constrainPointToCanvas(getCanvasCoords(event));
    setMousePos(point);

    if (draggingPointIndex < 0) return;

    updateActivePhoto((photo) => ({
      ...photo,
      saved: false,
      points: photo.points.map((currentPoint, index) =>
        index === draggingPointIndex ? point : currentPoint,
      ),
    }));
  };

  const handleCanvasPointerUp = (event) => {
    if (isPanning) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      setIsPanning(false);
      return;
    }

    if (draggingPointIndex >= 0) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setDraggingPointIndex(-1);
  };

  const navigatePhoto = (direction) => {
    if (activePhotoIndex < 0) return;
    if (direction === "prev" && activePhotoIndex > 0) {
      setActiveId(photos[activePhotoIndex - 1].id);
      setSelectedPointIndex(-1);
    }
    if (direction === "next" && activePhotoIndex < photos.length - 1) {
      setActiveId(photos[activePhotoIndex + 1].id);
      setSelectedPointIndex(-1);
    }
  };

  const updatePhotoEdits = (photoId, patch) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              ...patch,
              localEditRecipe: patch.localEditRecipe
                ? makeLocalEditRecipe(patch.localEditRecipe)
                : photo.localEditRecipe ?? makeLocalEditRecipe(),
              saved: false,
            }
          : photo,
      ),
    );
  };

  const applyLocalRecipeToSelected = (recipe) => {
    if (selectedPhotoIds.length === 0) return;
    setPhotos((current) =>
      current.map((photo) =>
        selectedPhotoIds.includes(photo.id)
          ? {
              ...photo,
              localEditRecipe: makeLocalEditRecipe(recipe),
              saved: false,
            }
          : photo,
      ),
    );
    showFeedback("success", `Ajuste local aplicado em ${selectedPhotoIds.length} foto(s).`);
  };

  const applyGlobalLookToScope = (scope) => {
    if (scope === "all") {
      setPhotos((current) =>
        current.map((photo) => ({
          ...photo,
          disableGlobalLook: false,
          saved: false,
        })),
      );
      showFeedback("success", "Look global habilitado para todas as fotos.");
      return;
    }

    if (selectedPhotoIds.length === 0) {
      showFeedback("info", "Selecione fotos no editor para aplicar o look em lote.");
      return;
    }

    setPhotos((current) =>
      current.map((photo) =>
        selectedPhotoIds.includes(photo.id)
          ? { ...photo, disableGlobalLook: false, saved: false }
          : photo,
      ),
    );
    showFeedback("success", `Look global habilitado em ${selectedPhotoIds.length} foto(s).`);
  };

  const applyPostEditsToCanvas = (canvas, photo) => {
    const activeLocalRecipe = photo.localEditRecipe ?? DEFAULT_LOCAL_EDIT_RECIPE;
    const shouldApplyGlobal = !photo.disableGlobalLook;
    const effectiveGlobalRecipe = shouldApplyGlobal ? globalLookRecipe : DEFAULT_GLOBAL_LOOK_RECIPE;
    const effectiveLut = shouldApplyGlobal ? activeLut : null;

    const hasLocal = hasMeaningfulAdjustments(activeLocalRecipe, DEFAULT_LOCAL_EDIT_RECIPE);
    const hasGlobal = hasMeaningfulAdjustments(effectiveGlobalRecipe, DEFAULT_GLOBAL_LOOK_RECIPE) || Boolean(effectiveLut);
    if (!hasLocal && !hasGlobal) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const processed = applyRecipeToImageData(
      imageData,
      activeLocalRecipe,
      effectiveGlobalRecipe,
      effectiveLut,
    );
    ctx.putImageData(processed, 0, 0);
  };

  const exportStructuredZip = async () => {
    if (!plateImgObj) {
      setFeedback({ type: "error", message: "Envie a imagem da placa antes de exportar." });
      return;
    }

    const photosToSave = photos.filter((photo) => photo.points.length === 4 && !photo.saved);
    if (photosToSave.length === 0) {
      setFeedback({ type: "info", message: "Nenhuma edicao nova encontrada para exportar." });
      return;
    }

    setIsExporting(true);
    try {
      const zip = new JSZip();

      for (const photo of photosToSave) {
        const sourceImage = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = photo.url;
        });

        const canvas = document.createElement("canvas");
        canvas.width = sourceImage.width;
        canvas.height = sourceImage.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(sourceImage, 0, 0);
        drawWarpedPlate(ctx, plateImgObj, photo.points);
        applyPostEditsToCanvas(canvas, photo);

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (result) => (result ? resolve(result) : reject(new Error("Falha ao gerar imagem."))),
            "image/jpeg",
            0.95,
          );
        });

        zip.file(photo.relativePath, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `placas_processadas_${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      setPhotos((current) =>
        current.map((photo) =>
          photo.points.length === 4 ? { ...photo, saved: true } : photo,
        ),
      );
      setFeedback({
        type: "success",
        message: `${photosToSave.length} imagem${photosToSave.length > 1 ? "ns" : ""} exportada${photosToSave.length > 1 ? "s" : ""} no ZIP.`,
      });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "Erro ao gerar o ZIP." });
    } finally {
      setIsExporting(false);
    }
  };

  const openPostEditor = () => {
    if (!activePhoto) {
      showFeedback("info", "Abra uma foto para usar o editor pos.");
      return;
    }
    startTransition(() => {
      setIsPostEditorOpen(true);
      setSelectedPhotoIds((current) => (current.length > 0 ? current : [activePhoto.id]));
    });
  };

  const closePostEditor = () => {
    setIsPostEditorOpen(false);
  };

  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)] xl:flex-row">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.06),transparent_24%)]" />

      <PhotoSidebar
        plateImgData={plateImgData}
        onPlateUpload={handlePlateUpload}
        onFolderSelection={handleFolderSelection}
        onPhotoUpload={handlePhotoUpload}
        plateInputRef={plateInputRef}
        folderInputRef={folderInputRef}
        photoInputRef={photoInputRef}
        groupedPhotos={groupedPhotos}
        photos={deferredPhotos}
        activeId={activeId}
        activePhotoPath={activePhoto?.path ?? null}
        expandedFolders={expandedFolders}
        toggleFolder={toggleFolder}
        expandAllFolders={() => setAllFoldersExpanded(true)}
        collapseAllFolders={() => setAllFoldersExpanded(false)}
        setActiveId={setActiveId}
        removePhoto={removePhoto}
        completedCount={completedCount}
        unsavedCount={unsavedCount}
        exportStructuredZip={exportStructuredZip}
        isExporting={isExporting}
      />

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row" ref={containerRef}>
        <EditorCanvas
          photos={photos}
          activePhoto={activePhoto}
          activePhotoIndex={activePhotoIndex}
          navigatePhoto={navigatePhoto}
          mousePos={mousePos}
          activeDim={activeDim}
          zoom={zoom}
          canvasRef={canvasRef}
          previewCanvasRef={previewCanvasRef}
          canvasScrollRef={canvasScrollRef}
          lupaCanvasRef={lupaCanvasRef}
          handleCanvasClick={handleCanvasClick}
          handleCanvasPointerDown={handleCanvasPointerDown}
          handleCanvasPointerMove={handleCanvasPointerMove}
          handleCanvasPointerUp={handleCanvasPointerUp}
          setMousePos={setMousePos}
          selectedPointIndex={selectedPointIndex}
          isSpaceDown={isSpaceDown}
          isPanning={isPanning}
          showLoupe={Boolean(activePhoto && mousePos)}
        />

        <PointInspector
          activePhoto={activePhoto}
          activePhotoIndex={activePhotoIndex}
          totalPhotos={photos.length}
          zoom={zoom}
          setZoom={setZoom}
          applyZoomDelta={applyZoomDelta}
          clearPoints={clearPoints}
          selectedPointIndex={selectedPointIndex}
          setSelectedPointIndex={setSelectedPointIndex}
          moveSelectedPoint={moveSelectedPoint}
          hasLocalEdits={activeHasLocalEdits}
          hasGlobalLook={activeHasGlobalLook}
          openPostEditor={openPostEditor}
        />
      </div>

      <Suspense
        fallback={
          <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(2,6,23,0.6)]">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[rgba(6,11,24,0.92)] px-5 py-3 text-white shadow-xl">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Carregando editor pos...
            </div>
          </div>
        }
      >
        {isPostEditorOpen ? (
          <PostEditorModule
            photos={photos}
            activePhoto={activePhoto}
            activeId={activeId}
            setActiveId={setActiveId}
            selectedPhotoIds={selectedPhotoIds}
            setSelectedPhotoIds={setSelectedPhotoIds}
            globalLookRecipe={globalLookRecipe}
            setGlobalLookRecipe={setGlobalLookRecipe}
            customLuts={customLuts}
            setCustomLuts={setCustomLuts}
            customPresets={customPresets}
            setCustomPresets={setCustomPresets}
            localClipboard={localClipboard}
            setLocalClipboard={setLocalClipboard}
            updatePhotoEdits={updatePhotoEdits}
            applyLocalRecipeToSelected={applyLocalRecipeToSelected}
            applyGlobalLookToScope={applyGlobalLookToScope}
            showFeedback={showFeedback}
            closeEditor={closePostEditor}
          />
        ) : null}
      </Suspense>

      <AnimatePresence>
        {feedback ? (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="pointer-events-none absolute bottom-5 right-5 z-50 max-w-sm"
          >
            <div className="pointer-events-auto flex items-start gap-3 rounded-[24px] border border-white/10 bg-[rgba(6,11,24,0.92)] px-4 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <div className="mt-0.5 text-cyan-100">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                ) : feedback.type === "error" ? (
                  <AlertCircle className="h-5 w-5 text-rose-300" />
                ) : (
                  <Info className="h-5 w-5 text-cyan-200" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">Aviso do fluxo</div>
                <div className="mt-1 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                  {feedback.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="rounded-full p-1 text-[color:var(--muted-foreground)] transition hover:bg-white/6 hover:text-white"
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
