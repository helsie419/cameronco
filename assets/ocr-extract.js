/* ============================================================================
   OCR-EXTRACT — reads text out of a screenshot pasted or uploaded from an
   insurer's portal, so it can be run through the same rule-based parser as
   typed/copied text (paste-extract.js).

   Uses Tesseract.js, loaded lazily from a CDN on first use (no build step,
   no API key, runs entirely in the browser).
   ========================================================================== */

const OCR_EXTRACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let ocrExtractLoadingPromise = null;

function ocrExtractLoadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (ocrExtractLoadingPromise) return ocrExtractLoadingPromise;
  ocrExtractLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = OCR_EXTRACT_CDN;
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error('Could not load the OCR engine — check your internet connection'));
    document.head.appendChild(script);
  }).catch((err) => {
    // Don't cache a failed load — a transient network blip shouldn't
    // permanently break OCR until the page is reloaded. The failed
    // <script> tag is harmless left in place; the next attempt just adds
    // another one.
    ocrExtractLoadingPromise = null;
    throw err;
  });
  return ocrExtractLoadingPromise;
}

/* Insurer portal screenshots are usually a browser window shrunk to fit —
   dense grids of small text. Tesseract is tuned for scanned-document-sized
   text and reads that kind of source poorly at native resolution. Upscaling
   and boosting contrast before recognition (a standard OCR pre-processing
   step) measurably improves accuracy on this kind of source. Falls back to
   the original image if canvas processing isn't available. */
async function ocrExtractPreprocessImage(image) {
  const bitmap = await createImageBitmap(image);
  try {
    const scale = Math.min(3, Math.max(1, 1600 / bitmap.width));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    const contrast = 1.4;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
      d[i] = d[i + 1] = d[i + 2] = adjusted;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

/**
 * Run OCR on an image (File/Blob/data URL) and return the recognised text.
 * onProgress(fraction 0..1) is called during recognition; optional.
 */
async function ocrExtractImageToText(image, onProgress) {
  const Tesseract = await ocrExtractLoadTesseract();
  let target = image;
  try {
    target = await ocrExtractPreprocessImage(image);
  } catch {
    // createImageBitmap/canvas unsupported or failed — OCR the raw image
  }
  const { data } = await Tesseract.recognize(target, 'eng', {
    logger: (msg) => {
      if (onProgress && msg.status === 'recognizing text' && typeof msg.progress === 'number') {
        onProgress(msg.progress);
      }
    },
  });
  return data.text || '';
}

/** True if a clipboard/drop DataTransfer carries an image the OCR can read. */
function ocrExtractFindImageItem(dataTransfer) {
  if (!dataTransfer || !dataTransfer.items) return null;
  for (const item of dataTransfer.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
}
