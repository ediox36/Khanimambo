/**
 * Reads an image File selected by the user, resizes it cleanly on an offscreen canvas,
 * and returns a lightweight Data URL suitable for fast upload in Mozambique mobile networks.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 840,
  quality = 0.8
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seleccione um ficheiro de imagem válido (JPG, PNG ou WebP).');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('A imagem não pode exceder 10 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro de imagem.'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido ou corrompido.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}
