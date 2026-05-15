import { startTransition, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
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

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [plateImgData, setPlateImgData] = useState(null);
  const [plateImgObj, setPlateImgObj] = useState(null);
  const [plateDataUrl, setPlateDataUrl] = useState(null);
  const [activeImageObj, setActiveImageObj] = useState(null);
  const [activeDim, setActiveDim] = useState({ w: 0, h: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
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
  const [pointHistory, setPointHistory] = useState({});

  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const lupaCanvasRef = useRef(null);
  const photosRef = useRef([]);
  const plateInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const canvasScrollRef = useRef(null);
  const panStateRef = useRef({ pointerX: 0, pointerY: 0, scrollLeft: 0, scrollTop: 0 });
  const dragHistoryCommittedRef = useRef(false);
  const zoomRef = useRef(0);
  const fitZoomRef = useRef(1);
  const pendingZoomAnchorRef = useRef(null);
  const thumbnailQueueRef = useRef(new Set());
  const thumbnailErrorRef = useRef(new Set());
  const imageWorkerRef = useRef(null);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  const activePhoto = photos.find((photo) => photo.id === activeId) ?? null;
  const deferredPhotos = useDeferredValue(photos);
  const activePhotoIndex = photos.findIndex((photo) => photo.id === activeId);
  const completedCount = photos.filter((photo) => photo.points.length === 4).length;
  const unsavedCount = photos.filter((photo) => photo.points.length === 4 && !photo.saved).length;
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

  const getViewportMetrics = useCallback(() => {
    const container = canvasScrollRef.current;
    if (!container) {
      return {
        width: 1,
        height: 1,
      };
    }

    const computedStyle = window.getComputedStyle(container);
    const paddingX = Number.parseFloat(computedStyle.paddingLeft || "0") + Number.parseFloat(computedStyle.paddingRight || "0");
    const paddingY = Number.parseFloat(computedStyle.paddingTop || "0") + Number.parseFloat(computedStyle.paddingBottom || "0");

    return {
      width: Math.max(container.clientWidth - paddingX, 1),
      height: Math.max(container.clientHeight - paddingY, 1),
    };
  }, []);

  const liveViewportSize = getViewportMetrics();
  const effectiveViewportSize =
    viewportSize.width > 1 && viewportSize.height > 1 ? viewportSize : liveViewportSize;

  const fitZoom = useMemo(() => {
    if (activeDim.w <= 0 || activeDim.h <= 0 || effectiveViewportSize.width <= 1 || effectiveViewportSize.height <= 1) return 1;
    const fitScale = Math.min(effectiveViewportSize.width / activeDim.w, effectiveViewportSize.height / activeDim.h);
    return Math.max(fitScale, 0.05);
  }, [activeDim.h, activeDim.w, effectiveViewportSize.height, effectiveViewportSize.width]);

  const resolvedZoom = zoom === 0 ? fitZoom : zoom;
  const zoomLabel = zoom === 0 ? "FIT" : `${Math.round(resolvedZoom * 100)}%`;
  const pointBleed = useMemo(() => {
    if (activeDim.w <= 0 || activeDim.h <= 0) return 0;
    return Math.ceil(Math.max(240, Math.max(activeDim.w, activeDim.h) * 0.35));
  }, [activeDim.h, activeDim.w]);

  const queueZoomAnchor = useCallback((anchorClientPoint) => {
    const container = canvasScrollRef.current;
    const previewCanvas = previewCanvasRef.current;
    const wrapper = previewCanvas?.parentElement;
    if (!container || !wrapper) {
      pendingZoomAnchorRef.current = null;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const viewportOffsetX = anchorClientPoint
      ? clamp(anchorClientPoint.x - containerRect.left, 0, containerRect.width)
      : container.clientWidth / 2;
    const viewportOffsetY = anchorClientPoint
      ? clamp(anchorClientPoint.y - containerRect.top, 0, containerRect.height)
      : container.clientHeight / 2;
    const anchorRatioX = wrapperRect.width > 0
      ? clamp(
          (anchorClientPoint ? anchorClientPoint.x - wrapperRect.left : wrapperRect.width / 2) / wrapperRect.width,
          0,
          1,
        )
      : 0.5;
    const anchorRatioY = wrapperRect.height > 0
      ? clamp(
          (anchorClientPoint ? anchorClientPoint.y - wrapperRect.top : wrapperRect.height / 2) / wrapperRect.height,
          0,
          1,
        )
      : 0.5;

    pendingZoomAnchorRef.current = {
      anchorRatioX,
      anchorRatioY,
      viewportOffsetX,
      viewportOffsetY,
    };
  }, []);

  const applyZoomDelta = useCallback((direction, intensity = 1, anchorClientPoint = null, source = "wheel") => {
    queueZoomAnchor(anchorClientPoint);
    setZoom((current) => {
      const isFitMode = current === 0;
      if (isFitMode && direction < 0) return 0;

      const baseZoom = isFitMode ? fitZoomRef.current : current;
      const step = source === "button" ? 1.14 : 1.08;
      const factor = Math.pow(step, intensity * direction);
      const nextZoom = clamp(baseZoom * factor, 0.08, 8);
      if (Math.abs(nextZoom - fitZoomRef.current) < 0.01) return 0;
      return nextZoom;
    });
  }, [queueZoomAnchor]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    fitZoomRef.current = fitZoom;
  }, [fitZoom]);

  useLayoutEffect(() => {
    const container = canvasScrollRef.current;
    if (!container) return undefined;

    const updateViewport = () => {
      setViewportSize(getViewportMetrics());
    };

    updateViewport();
    const initialFrameId = window.requestAnimationFrame(updateViewport);

    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(container);
    return () => {
      window.cancelAnimationFrame(initialFrameId);
      resizeObserver.disconnect();
    };
  }, [getViewportMetrics, activeId]);

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setViewportSize(getViewportMetrics());
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeDim.h, activeDim.w, activeId, getViewportMetrics]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const downloadZip = (blobUrl, fileName) => {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    link.type = "application/zip";
    document.body.append(link);
    link.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      link.remove();
    }, 30_000);
  };

  useEffect(() => {
    const worker = new Worker(new URL("@/lib/image-worker.js", import.meta.url), { type: "module" });
    imageWorkerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, data } = event.data;

      if (type === "THUMBNAIL_PROGRESS") {
        setFeedback({ type: "info", message: `Preparando miniaturas... ${data.completed}/${data.total}` });
      }

      if (type === "THUMBNAILS_COMPLETE") {
        const { results } = data;
        results.forEach((result) => {
          if (result?.thumbBlob) {
            thumbnailErrorRef.current.delete(result.id);
          } else {
            thumbnailErrorRef.current.add(result.id);
          }
        });
        setPhotos((current) =>
          current.map((photo) => {
            const result = results.find((r) => r.id === photo.id);
            return result?.thumbBlob ? { ...photo, thumbUrl: URL.createObjectURL(result.thumbBlob) } : photo;
          }),
        );
        thumbnailQueueRef.current.clear();
      }

      if (type === "PROCESS_PROGRESS") {
        setExportProgress({ current: data.completed, total: data.total });
      }

      if (type === "PROCESS_COMPLETE") {
        worker.postMessage({ type: "BUILD_ZIP", data: { results: data.results, plateDataUrl } });
      }

      if (type === "ZIP_PROGRESS") {
        setExportProgress({ current: data.completed, total: data.total });
      }

      if (type === "ZIP_COMPLETE") {
        downloadZip(data.blobUrl, data.fileName);
        setPhotos((current) =>
          current.map((photo) =>
            photo.points.length === 4 ? { ...photo, saved: true } : photo,
          ),
        );
        setIsExporting(false);
        setExportProgress({ current: 0, total: 0 });
        setFeedback({ type: "success", message: `${data.count} imagens exportadas no ZIP.` });
      }
    };

    return () => worker.terminate();
  }, [plateDataUrl]);

  useEffect(() => {
    const photosWithoutThumb = photos.filter(
      (photo) =>
        !photo.thumbUrl &&
        !thumbnailQueueRef.current.has(photo.id) &&
        !thumbnailErrorRef.current.has(photo.id),
    );
    if (photosWithoutThumb.length === 0) return;

    photosWithoutThumb.forEach((p) => thumbnailQueueRef.current.add(p.id));
    imageWorkerRef.current?.postMessage({
      type: "CREATE_THUMBNAILS",
      data: { photos: photosWithoutThumb },
    });
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
      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedPointIndex >= 0 && activePhoto?.points[selectedPointIndex]) {
          const nextPoints = activePhoto.points.filter((_, index) => index !== selectedPointIndex);
          pushPointHistorySnapshot(activePhoto.id, nextPoints);
          applyPointsToPhoto(activePhoto.id, nextPoints);
          setSelectedPointIndex(-1);
        } else if (activePhoto?.points.length) {
          undoPoints();
        } else {
          setSelectedPointIndex(-1);
        }
        setDraggingPointIndex(-1);
        setIsPanning(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoPoints();
        } else {
          undoPoints();
        }
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedPointIndex >= 0 && activePhoto?.points[selectedPointIndex]) {
        event.preventDefault();
        pushPointHistorySnapshot(activePhoto.id, activePhoto.points.filter((_, index) => index !== selectedPointIndex));
        applyPointsToPhoto(activePhoto.id, activePhoto.points.filter((_, index) => index !== selectedPointIndex));
        setSelectedPointIndex(-1);
      }
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
  }, [selectedPointIndex, activePhoto, pointHistory]);

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
      setMousePos({ x: img.width / 2, y: img.height / 2 });
    };
    img.src = activePhoto.url;
  }, [activePhoto?.id, activePhoto?.url]);

  useEffect(() => {
    if (selectedPointIndex >= (activePhoto?.points.length ?? 0)) {
      setSelectedPointIndex(-1);
    }
  }, [activePhoto, selectedPointIndex]);

  useEffect(() => {
    if (zoom !== 0 || !canvasScrollRef.current) return;
    canvasScrollRef.current.scrollLeft = 0;
    canvasScrollRef.current.scrollTop = 0;
  }, [zoom, activeId, fitZoom]);

  useLayoutEffect(() => {
    const pendingAnchor = pendingZoomAnchorRef.current;
    const container = canvasScrollRef.current;
    const previewCanvas = previewCanvasRef.current;
    const wrapper = previewCanvas?.parentElement;

    if (!pendingAnchor || !container || !wrapper) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      container.scrollLeft = Math.max(
        wrapper.offsetLeft + wrapper.offsetWidth * pendingAnchor.anchorRatioX - pendingAnchor.viewportOffsetX,
        0,
      );
      container.scrollTop = Math.max(
        wrapper.offsetTop + wrapper.offsetHeight * pendingAnchor.anchorRatioY - pendingAnchor.viewportOffsetY,
        0,
      );
      pendingZoomAnchorRef.current = null;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [resolvedZoom, effectiveViewportSize.height, effectiveViewportSize.width, activeId]);

  useEffect(() => {
    if (!activeImageObj || !canvasRef.current || !previewCanvasRef.current || !activePhoto) return;

    const canvas = canvasRef.current;
    const preview = previewCanvasRef.current;
    if (canvas.width !== activeImageObj.width || canvas.height !== activeImageObj.height) {
      canvas.width = activeImageObj.width;
      canvas.height = activeImageObj.height;
    }
    const previewWidth = activeImageObj.width + pointBleed * 2;
    const previewHeight = activeImageObj.height + pointBleed * 2;
    if (preview.width !== previewWidth || preview.height !== previewHeight) {
      preview.width = previewWidth;
      preview.height = previewHeight;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(activeImageObj, 0, 0);

    if (activePhoto.points.length === 4 && plateImgObj) {
      drawWarpedPlate(ctx, plateImgObj, activePhoto.points);
    }
  }, [activeImageObj, activePhoto, plateImgObj, pointBleed]);

  useEffect(() => {
    if (!previewCanvasRef.current || !activeImageObj || !activePhoto) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = activeImageObj.width;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pointBleed, pointBleed);

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
    ctx.restore();
  }, [activeImageObj, activePhoto, mousePos, pointBleed, selectedPointIndex]);

  useEffect(() => {
    const nativeWheelHandler = (event) => {
      if (!activePhoto || !event.ctrlKey || !canvasScrollRef.current) return;
      const eventTarget = event.target;
      if (!(eventTarget instanceof Node) || !canvasScrollRef.current.contains(eventTarget)) return;
      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();
      const direction = event.deltaY < 0 ? 1 : -1;
      const intensity = clamp(Math.abs(event.deltaY) / 180, 0.45, 1.35);
      applyZoomDelta(direction, intensity, { x: event.clientX, y: event.clientY }, "wheel");
    };

    window.addEventListener("wheel", nativeWheelHandler, { passive: false, capture: true });
    return () => {
      window.removeEventListener("wheel", nativeWheelHandler, { capture: true });
    };
  }, [activePhoto, applyZoomDelta]);

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
      mousePos.x + pointBleed - source / 2,
      mousePos.y + pointBleed - source / 2,
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
  }, [mousePos, activePhoto, pointBleed, selectedPointIndex]);

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

  const pushPointHistorySnapshot = (photoId, nextPoints) => {
    setPointHistory((current) => {
      const entry = current[photoId] ?? { undo: [], redo: [] };
      const previousPoints = photosRef.current.find((photo) => photo.id === photoId)?.points ?? [];
      if (JSON.stringify(previousPoints) === JSON.stringify(nextPoints)) return current;

      return {
        ...current,
        [photoId]: {
          undo: [...entry.undo, previousPoints.map((point) => ({ ...point }))],
          redo: [],
        },
      };
    });
  };

  const applyPointsToPhoto = (photoId, nextPoints) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              points: nextPoints.map((point) => ({ ...point })),
              saved: false,
            }
          : photo,
      ),
    );
  };

  const undoPoints = () => {
    if (!activePhoto) return;
    const historyEntry = pointHistory[activePhoto.id];
    if (!historyEntry || historyEntry.undo.length === 0) return;

    const previousSnapshot = historyEntry.undo[historyEntry.undo.length - 1];
    const currentPoints = activePhoto.points.map((point) => ({ ...point }));

    applyPointsToPhoto(activePhoto.id, previousSnapshot);
    setSelectedPointIndex(-1);
    setPointHistory((current) => ({
      ...current,
      [activePhoto.id]: {
        undo: current[activePhoto.id].undo.slice(0, -1),
        redo: [...current[activePhoto.id].redo, currentPoints],
      },
    }));
  };

  const redoPoints = () => {
    if (!activePhoto) return;
    const historyEntry = pointHistory[activePhoto.id];
    if (!historyEntry || historyEntry.redo.length === 0) return;

    const nextSnapshot = historyEntry.redo[historyEntry.redo.length - 1];
    const currentPoints = activePhoto.points.map((point) => ({ ...point }));

    applyPointsToPhoto(activePhoto.id, nextSnapshot);
    setSelectedPointIndex(-1);
    setPointHistory((current) => ({
      ...current,
      [activePhoto.id]: {
        undo: [...current[activePhoto.id].undo, currentPoints],
        redo: current[activePhoto.id].redo.slice(0, -1),
      },
    }));
  };

  const getCanvasCoords = (event) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width - pointBleed,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height - pointBleed,
    };
  };

  const constrainPointToEditableArea = (point) => ({
    x: clamp(point.x, -pointBleed, activeDim.w + pointBleed),
    y: clamp(point.y, -pointBleed, activeDim.h + pointBleed),
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
    pushPointHistorySnapshot(
      activePhoto.id,
      activePhoto.points.map((point, index) =>
        index === selectedPointIndex
          ? constrainPointToEditableArea({ x: point.x + dx, y: point.y + dy })
          : point,
      ),
    );
    updateActivePhoto((photo) => ({
      ...photo,
      saved: false,
      points: photo.points.map((point, index) =>
        index === selectedPointIndex
          ? constrainPointToEditableArea({ x: point.x + dx, y: point.y + dy })
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

    const newPhotos = imageFiles.map((file) => createPhotoRecord(file, folderMode));
    startTransition(() => {
      setPhotos((current) => {
        const updated = [...current, ...newPhotos];
        if (current.length === 0 && updated.length > 0) {
          setActiveId(updated[0].id);
        }
        return updated;
      });
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
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result ?? null;
      setPlateImgData(dataUrl);
      setPlateDataUrl(dataUrl);
    };
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
    pushPointHistorySnapshot(activePhoto.id, []);
    setSelectedPointIndex(-1);
    updateActivePhoto((photo) => ({ ...photo, points: [], saved: false }));
  };

  const removePhoto = (id) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        if (target.thumbUrl) {
          URL.revokeObjectURL(target.thumbUrl);
        }
      }
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

    const rawPoint = constrainPointToEditableArea(getCanvasCoords(event));
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

    const snapped = constrainPointToEditableArea(getSnappedPoint(rawPoint, activePhoto.points));
    pushPointHistorySnapshot(activePhoto.id, [...activePhoto.points, snapped]);
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

    const point = constrainPointToEditableArea(getCanvasCoords(event));
    const nearestIndex = findNearestPointIndex(
      activePhoto.points,
      point,
      Math.max(20, activeDim.w / 48),
    );

    if (nearestIndex >= 0) {
      setSelectedPointIndex(nearestIndex);
      setDraggingPointIndex(nearestIndex);
      dragHistoryCommittedRef.current = false;
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

    const point = constrainPointToEditableArea(getCanvasCoords(event));
    setMousePos(point);

    if (draggingPointIndex < 0) return;
    if (!dragHistoryCommittedRef.current) {
      pushPointHistorySnapshot(
        activePhoto.id,
        activePhoto.points.map((currentPoint, index) =>
          index === draggingPointIndex ? point : currentPoint,
        ),
      );
      dragHistoryCommittedRef.current = true;
    }

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
    dragHistoryCommittedRef.current = false;
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
    setExportProgress({ current: 0, total: photosToSave.length });

    try {
      imageWorkerRef.current?.postMessage({
        type: "PROCESS_PHOTOS",
        data: { photos: photosToSave, plateDataUrl },
      });
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", message: "Erro ao iniciar processamento." });
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
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

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <EditorCanvas
          photos={photos}
          activePhoto={activePhoto}
          activePhotoIndex={activePhotoIndex}
          navigatePhoto={navigatePhoto}
          mousePos={mousePos}
          activeDim={activeDim}
          pointBleed={pointBleed}
          resolvedZoom={resolvedZoom}
          viewportSize={effectiveViewportSize}
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
          zoomLabel={zoomLabel}
          setZoomToFit={() => setZoom(0)}
          applyZoomDelta={applyZoomDelta}
          clearPoints={clearPoints}
          selectedPointIndex={selectedPointIndex}
          setSelectedPointIndex={setSelectedPointIndex}
          moveSelectedPoint={moveSelectedPoint}
        />
      </div>

      {isExporting && exportProgress.total > 0 && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-64 rounded-2xl border border-white/10 bg-[rgba(6,11,24,0.95)] p-6 shadow-2xl">
            <div className="text-center text-sm font-medium text-white mb-3">
              Processando {exportProgress.current}/{exportProgress.total}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-300"
                style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

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
