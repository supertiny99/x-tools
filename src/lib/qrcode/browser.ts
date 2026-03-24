import jsQR from 'jsqr';

import type { ImageDataLike } from './types';

export async function decodeImageFile(file: File): Promise<{ previewUrl: string; imageData: ImageDataLike }> {
  const previewUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('canvas unavailable'));
        return;
      }

      context.drawImage(image, 0, 0, image.width, image.height);
      const imageData = context.getImageData(0, 0, image.width, image.height);

      resolve({
        previewUrl,
        imageData: {
          data: imageData.data,
          width: imageData.width,
          height: imageData.height,
        },
      });
    };

    image.onerror = () => {
      reject(new Error('image load failed'));
    };

    image.src = previewUrl;
  });
}

export function scanQrCode(imageData: ImageDataLike): { data: string } | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  });

  return code ? { data: code.data } : null;
}
