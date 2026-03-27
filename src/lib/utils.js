import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const IMAGE_REGEX = /\.(jpg|jpeg|png)$/i;

export function makePhotoId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function distanceBetween(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

export function findNearestPointIndex(points, candidate, threshold) {
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  points.forEach((point, index) => {
    const distance = distanceBetween(point, candidate);
    if (distance <= threshold && distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  });

  return nearestIndex;
}

export function normalizeRelativePath(file, folderMode) {
  const rawRelative = (folderMode ? file.webkitRelativePath : file.name) || file.name;
  const relativePath = rawRelative.replaceAll("\\", "/");
  const parts = relativePath.split("/");
  parts.pop();
  const path = parts.length ? `${parts.join("/")}/` : "Avulsas/";

  return {
    relativePath: folderMode && rawRelative ? relativePath : `Avulsas/${file.name}`,
    path,
  };
}

export function createPhotoRecord(file, folderMode) {
  const { relativePath, path } = normalizeRelativePath(file, folderMode);

  return {
    id: makePhotoId(),
    file,
    path,
    fileName: file.name,
    relativePath,
    url: URL.createObjectURL(file),
    thumbUrl: null,
    points: [],
    saved: false,
  };
}

export function revokePhotoUrls(photos) {
  photos.forEach((photo) => {
    URL.revokeObjectURL(photo.url);
    if (photo.thumbUrl) {
      URL.revokeObjectURL(photo.thumbUrl);
    }
  });
}

export async function createThumbnailUrl(file, maxSize = 220) {
  let sourceImage = null;
  let temporaryUrl = null;

  if (typeof createImageBitmap === "function") {
    sourceImage = await createImageBitmap(file);
  } else {
    temporaryUrl = URL.createObjectURL(file);
    sourceImage = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = temporaryUrl;
    });
  }

  const scale = Math.min(maxSize / sourceImage.width, maxSize / sourceImage.height, 1);
  const width = Math.max(1, Math.round(sourceImage.width * scale));
  const height = Math.max(1, Math.round(sourceImage.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceImage, 0, 0, width, height);
  sourceImage.close?.();
  if (temporaryUrl) {
    URL.revokeObjectURL(temporaryUrl);
  }

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.78);
  });

  return blob ? URL.createObjectURL(blob) : null;
}

export function drawWarpedPlate(ctx, plate, points) {
  const width = plate.width;
  const height = plate.height;
  const [p0, p1, p2, p3] = points;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(
    (p1.x - p0.x) / width,
    (p1.y - p0.y) / width,
    (p2.x - p1.x) / height,
    (p2.y - p1.y) / height,
    p0.x,
    p0.y,
  );
  ctx.drawImage(plate, 0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x - 1, p0.y - 1);
  ctx.lineTo(p2.x + 1, p2.y + 1);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(
    (p2.x - p3.x) / width,
    (p2.y - p3.y) / width,
    (p3.x - p0.x) / height,
    (p3.y - p0.y) / height,
    p0.x,
    p0.y,
  );
  ctx.drawImage(plate, 0, 0, width, height);
  ctx.restore();
}
