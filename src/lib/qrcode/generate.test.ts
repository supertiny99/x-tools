import { describe, expect, test, vi } from 'vitest';

import { generateQrCode } from './generate';

describe('generateQrCode', () => {
  test('returns empty for blank input', async () => {
    const toDataURL = vi.fn();

    await expect(generateQrCode('   ', { toDataURL })).resolves.toEqual({ kind: 'empty' });
    expect(toDataURL).not.toHaveBeenCalled();
  });

  test('returns success with generated data url', async () => {
    const toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,abc');

    await expect(generateQrCode('https://example.com', { toDataURL })).resolves.toEqual({
      kind: 'success',
      dataUrl: 'data:image/png;base64,abc',
    });
    expect(toDataURL).toHaveBeenCalledWith('https://example.com', {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  });

  test('returns unified error when generator throws', async () => {
    const toDataURL = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(generateQrCode('hello', { toDataURL })).resolves.toEqual({
      kind: 'error',
      message: '生成二维码失败',
    });
  });
});
