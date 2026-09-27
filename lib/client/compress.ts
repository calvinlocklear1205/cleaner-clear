/**
 * Shrinks a camera photo on-device before upload: 1600px long edge, JPEG,
 * stepping quality down until it fits under maxBytes. A 12 MB iPhone photo
 * typically lands around 300–500 KB.
 *
 * Re-encoding through a canvas also strips EXIF (including GPS), which is
 * what we want — location comes from the Geolocation API instead.
 */
export async function compressImage(
  file: Blob,
  { maxEdge = 1600, quality = 0.7, minQuality = 0.4, maxBytes = 550_000 } = {},
): Promise<Blob> {
  const source = await decode(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
    const width = Math.round(source.width * scale);
    const height = Math.round(source.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source.image, 0, 0, width, height);

    let q = quality;
    let blob = await toJpeg(canvas, q);
    while (blob.size > maxBytes && q > minQuality) {
      q = Math.max(minQuality, q - 0.1);
      blob = await toJpeg(canvas, q);
    }
    // Free the canvas backing store promptly; iOS caps total canvas memory.
    canvas.width = canvas.height = 0;
    return blob;
  } finally {
    source.release();
  }
}

type Decoded = {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decode(file: Blob): Promise<Decoded> {
  // createImageBitmap honors EXIF orientation with imageOrientation: "from-image".
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // Fall through to <img>, which handles some formats createImageBitmap won't.
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Couldn't read that photo. Try taking it again.");
  }
  return {
    image: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't compress photo"))), "image/jpeg", quality),
  );
}
