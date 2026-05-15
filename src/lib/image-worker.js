import JSZip from "jszip";

const pendingJobs = new Map();
let jobIdCounter = 0;

self.onmessage = async (event) => {
  const { type, data, jobId } = event.data;

  switch (type) {
    case "CREATE_THUMBNAILS": {
      const { photos } = data;
      const results = [];
      const batchSize = 8;

      for (let i = 0; i < photos.length; i += batchSize) {
        const batch = photos.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (photo) => {
            try {
              const thumbBlob = await createThumbnailInWorker(photo.file);
              return { id: photo.id, thumbBlob };
            } catch (error) {
              return { id: photo.id, thumbBlob: null, error: true };
            }
          }),
        );
        results.push(...batchResults);

        self.postMessage({
          type: "THUMBNAIL_PROGRESS",
          data: { completed: Math.min(i + batchSize, photos.length), total: photos.length },
        });
      }

      self.postMessage({ type: "THUMBNAILS_COMPLETE", data: { results }, jobId });
      break;
    }

    case "PROCESS_PHOTOS": {
      const { photos, plateDataUrl } = data;
      const results = [];
      const plateImg = await loadImageBitmap(plateDataUrl);

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        try {
          const blob = await processPhotoWithPlate(photo, plateImg);
          results.push({ id: photo.id, blob, relativePath: photo.relativePath });
        } catch (error) {
          results.push({ id: photo.id, blob: null, error: true, relativePath: photo.relativePath });
        }

        if (i % 5 === 0 || i === photos.length - 1) {
          self.postMessage({
            type: "PROCESS_PROGRESS",
            data: { completed: i + 1, total: photos.length },
          });
        }
      }

      self.postMessage({ type: "PROCESS_COMPLETE", data: { results }, jobId });
      plateImg.close?.();
      break;
    }

    case "BUILD_ZIP": {
      const { results } = data;
      const zip = new JSZip();
      const validResults = results.filter((r) => r.blob && !r.error);

      for (let i = 0; i < validResults.length; i++) {
        const result = validResults[i];
        zip.file(result.relativePath, result.blob);

        if (i % 10 === 0 || i === validResults.length - 1) {
          self.postMessage({
            type: "ZIP_PROGRESS",
            data: { completed: i + 1, total: validResults.length },
          });
        }
      }

      const fileName = `placas-processadas-${Date.now()}.zip`;
      const content = await zip.generateAsync({
        type: "blob",
        mimeType: "application/zip",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const blobUrl = URL.createObjectURL(content);

      self.postMessage({
        type: "ZIP_COMPLETE",
        data: { blobUrl, fileName, count: validResults.length },
      });
      break;
    }

    default:
      break;
  }
};

async function loadImageBitmap(dataUrl) {
  if (typeof createImageBitmap !== "function") {
    throw new Error("createImageBitmap is not available in this worker");
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

async function createThumbnailInWorker(file, maxSize = 220) {
  let sourceImage = null;

  if (typeof createImageBitmap === "function") {
    sourceImage = await createImageBitmap(file);
  } else {
    throw new Error("createImageBitmap is not available in this worker");
  }

  const scale = Math.min(maxSize / sourceImage.width, maxSize / sourceImage.height, 1);
  const width = Math.max(1, Math.round(sourceImage.width * scale));
  const height = Math.max(1, Math.round(sourceImage.height * scale));
  if (typeof OffscreenCanvas !== "function") {
    sourceImage.close?.();
    throw new Error("OffscreenCanvas is not available in this worker");
  }

  const canvas = new OffscreenCanvas(width, height);

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceImage, 0, 0, width, height);
  sourceImage.close?.();
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.78 });

  return blob;
}

async function processPhotoWithPlate(photo, plateImg) {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
    throw new Error("Worker image processing is not available");
  }

  const img = await createImageBitmap(photo.file);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  drawWarpedPlate(ctx, plateImg, photo.points);
  img.close?.();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.95 });
  if (!blob) {
    throw new Error("Failed to create blob");
  }

  return blob;
}

function drawWarpedPlate(ctx, plate, points) {
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
