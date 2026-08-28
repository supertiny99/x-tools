export interface PosterQrLayer {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PosterQrDrawableLayer {
  image: HTMLImageElement;
  layer: PosterQrLayer;
}

const MIN_LAYER_SIZE = 24;

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

export function clampPosterQrLayer(layer: PosterQrLayer, posterWidth: number, posterHeight: number): PosterQrLayer {
  const maxWidth = Math.max(MIN_LAYER_SIZE, posterWidth);
  const maxHeight = Math.max(MIN_LAYER_SIZE, posterHeight);
  const width = Math.min(Math.max(MIN_LAYER_SIZE, Math.round(finiteOr(layer.width, MIN_LAYER_SIZE))), maxWidth);
  const height = Math.min(Math.max(MIN_LAYER_SIZE, Math.round(finiteOr(layer.height, MIN_LAYER_SIZE))), maxHeight);
  const x = Math.min(Math.max(0, Math.round(finiteOr(layer.x, 0))), Math.max(0, posterWidth - width));
  const y = Math.min(Math.max(0, Math.round(finiteOr(layer.y, 0))), Math.max(0, posterHeight - height));

  return { x, y, width, height };
}

export async function composePosterQrPng(
  poster: HTMLImageElement,
  layers: PosterQrDrawableLayer[],
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = poster.width;
  canvas.height = poster.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('当前浏览器不支持 Canvas 图片合成');
  }

  ctx.drawImage(poster, 0, 0);
  layers.forEach(({ image, layer }) => {
    const clamped = clampPosterQrLayer(layer, poster.width, poster.height);
    ctx.drawImage(image, clamped.x, clamped.y, clamped.width, clamped.height);
  });

  return canvas.toDataURL('image/png');
}
