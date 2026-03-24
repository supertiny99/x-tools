import type { QrGenerateDeps, QrGenerateResult } from './types';

const QR_CODE_OPTIONS = {
  width: 400,
  margin: 2,
  color: {
    dark: '#0f172a',
    light: '#ffffff',
  },
};

export async function generateQrCode(text: string, deps: QrGenerateDeps): Promise<QrGenerateResult> {
  if (!text.trim()) {
    return { kind: 'empty' };
  }

  try {
    const dataUrl = await deps.toDataURL(text, QR_CODE_OPTIONS);
    return {
      kind: 'success',
      dataUrl,
    };
  } catch {
    return {
      kind: 'error',
      message: '生成二维码失败',
    };
  }
}
