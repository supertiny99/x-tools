import { describe, expect, test, vi } from 'vitest';

import { parseQrCodeFile } from './parse';
import type { ImageDataLike } from './types';

function makeImageFile(type = 'image/png') {
  return new File(['mock'], 'qr.png', { type });
}

function makeImageData(): ImageDataLike {
  return {
    data: new Uint8ClampedArray([0, 0, 0, 255]),
    width: 1,
    height: 1,
  };
}

describe('parseQrCodeFile', () => {
  test('rejects non-image files', async () => {
    const decodeImageFile = vi.fn();
    const scanQrCode = vi.fn();

    await expect(parseQrCodeFile(new File(['x'], 'note.txt', { type: 'text/plain' }), {
      decodeImageFile,
      scanQrCode,
    })).resolves.toEqual({
      kind: 'error',
      message: '请上传图片文件',
    });
    expect(decodeImageFile).not.toHaveBeenCalled();
    expect(scanQrCode).not.toHaveBeenCalled();
  });

  test('returns read failure when decodeImageFile rejects', async () => {
    const decodeImageFile = vi.fn().mockRejectedValue(new Error('broken'));
    const scanQrCode = vi.fn();

    await expect(parseQrCodeFile(makeImageFile(), {
      decodeImageFile,
      scanQrCode,
    })).resolves.toEqual({
      kind: 'error',
      message: '读取图片失败',
    });
  });

  test('returns not found when scanQrCode returns null', async () => {
    const decodeImageFile = vi.fn().mockResolvedValue({
      previewUrl: 'blob:preview',
      imageData: makeImageData(),
    });
    const scanQrCode = vi.fn().mockReturnValue(null);

    await expect(parseQrCodeFile(makeImageFile(), {
      decodeImageFile,
      scanQrCode,
    })).resolves.toEqual({
      kind: 'error',
      message: '未能识别到二维码，请尝试更清晰的图片',
      previewUrl: 'blob:preview',
    });
  });

  test('returns success when scanQrCode returns data', async () => {
    const decodeImageFile = vi.fn().mockResolvedValue({
      previewUrl: 'blob:preview',
      imageData: makeImageData(),
    });
    const scanQrCode = vi.fn().mockReturnValue({ data: 'https://example.com' });

    await expect(parseQrCodeFile(makeImageFile(), {
      decodeImageFile,
      scanQrCode,
    })).resolves.toEqual({
      kind: 'success',
      text: 'https://example.com',
      previewUrl: 'blob:preview',
    });
  });
});
