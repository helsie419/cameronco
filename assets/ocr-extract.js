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

/**
 * Run OCR on an image (File/Blob/data URL) and return the recognised text.
 * onProgress(fraction 0..1) is called during recognition; optional.
 */
async function ocrExtractImageToText(image, onProgress) {
  const Tesseract = await ocrExtractLoadTesseract();
  const { data } = await Tesseract.recognize(image, 'eng', {
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
