import { describe, expect, test, vi } from 'vitest';

import { clampPosterQrLayer, composePosterQrPng } from './poster-qr';

describe('poster QR composition helpers', () => {
  test('clamps a QR layer within poster bounds', () => {
    expect(clampPosterQrLayer({ x: 950, y: -20, width: 200, height: 180 }, 1000, 1200)).toEqual({
      x: 800,
      y: 0,
      width: 200,
      height: 180,
    });
  });

  test('exports PNG using the original poster dimensions', async () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => 'data:image/png;base64,poster');
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL,
    } as unknown as HTMLCanvasElement;
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    const poster = { width: 1000, height: 1500 } as HTMLImageElement;
    const qr = {} as HTMLImageElement;

    const result = await composePosterQrPng(poster, [
      { image: qr, layer: { x: 100, y: 1200, width: 160, height: 160 } },
    ]);

    expect(createElement).toHaveBeenCalledWith('canvas');
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(1500);
    expect(drawImage).toHaveBeenNthCalledWith(1, poster, 0, 0);
    expect(drawImage).toHaveBeenNthCalledWith(2, qr, 100, 1200, 160, 160);
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(result).toBe('data:image/png;base64,poster');

    createElement.mockRestore();
  });
});
