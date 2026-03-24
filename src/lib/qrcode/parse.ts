import type { QrParseDeps, QrParseResult } from './types';

export async function parseQrCodeFile(file: File, deps: QrParseDeps): Promise<QrParseResult> {
  if (!file.type.startsWith('image/')) {
    return {
      kind: 'error',
      message: '请上传图片文件',
    };
  }

  try {
    const { previewUrl, imageData } = await deps.decodeImageFile(file);
    const code = deps.scanQrCode(imageData);

    if (!code) {
      return {
        kind: 'error',
        message: '未能识别到二维码，请尝试更清晰的图片',
        previewUrl,
      };
    }

    return {
      kind: 'success',
      text: code.data,
      previewUrl,
    };
  } catch {
    return {
      kind: 'error',
      message: '读取图片失败',
    };
  }
}
