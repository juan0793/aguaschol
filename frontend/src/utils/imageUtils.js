const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No fue posible procesar la imagen seleccionada."));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No fue posible optimizar la fotografia."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No fue posible leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });

export const optimizeImageForUpload = async (file) => {
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return file;
  }

  const sourceImage = await loadImageFromFile(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(sourceImage.width, sourceImage.height));
  const width = Math.max(1, Math.round(sourceImage.width * scale));
  const height = Math.max(1, Math.round(sourceImage.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(sourceImage, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const optimizedBlob = await canvasToBlob(canvas, outputType, outputType === "image/png" ? undefined : 0.78);

  if (optimizedBlob.size >= file.size) {
    return file;
  }

  const extension = outputType === "image/png" ? ".png" : ".jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "fotografia";

  return new File([optimizedBlob], `${baseName}${extension}`, {
    type: outputType,
    lastModified: Date.now()
  });
};

export const urlToDataUrl = async (url) => {
  const response = await fetch(url, { cache: "no-store" });
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No fue posible preparar la imagen para impresion."));
    reader.readAsDataURL(blob);
  });
};
