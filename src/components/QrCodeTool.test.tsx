import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const qrcodeMocks = vi.hoisted(() => ({
  generateQrCode: vi.fn(),
  parseQrCodeFile: vi.fn(),
  decodeImageFile: vi.fn(),
  scanQrCode: vi.fn(),
}));

vi.mock('../lib/qrcode', () => ({
  generateQrCode: qrcodeMocks.generateQrCode,
  parseQrCodeFile: qrcodeMocks.parseQrCodeFile,
  decodeImageFile: qrcodeMocks.decodeImageFile,
  scanQrCode: qrcodeMocks.scanQrCode,
}));

import QrCodeTool from './QrCodeTool';

describe('QrCodeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    qrcodeMocks.generateQrCode.mockResolvedValue({
      kind: 'success',
      dataUrl: 'data:image/png;base64,initial',
    });
  });

  test('generate tab shows qr image after successful generation', async () => {
    render(<QrCodeTool />);

    await waitFor(() => {
      expect(screen.getByAltText('QR Code')).toHaveAttribute('src', 'data:image/png;base64,initial');
    });

    qrcodeMocks.generateQrCode.mockResolvedValueOnce({
      kind: 'success',
      dataUrl: 'data:image/png;base64,next',
    });

    fireEvent.change(screen.getByPlaceholderText('输入网址、文本等...'), {
      target: { value: 'https://openai.com' },
    });

    await waitFor(() => {
      expect(screen.getByAltText('QR Code')).toHaveAttribute('src', 'data:image/png;base64,next');
    });
  });

  test('parse tab shows decoded text after successful parse', async () => {
    qrcodeMocks.parseQrCodeFile.mockResolvedValue({
      kind: 'success',
      text: 'https://example.com',
      previewUrl: 'blob:preview',
    });

    render(<QrCodeTool />);

    fireEvent.click(screen.getByRole('button', { name: /解析二维码/i }));
    const file = new File(['img'], 'qr.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
    });
  });

  test('parse tab shows error for invalid file', async () => {
    qrcodeMocks.parseQrCodeFile.mockResolvedValue({
      kind: 'error',
      message: '请上传图片文件',
    });

    render(<QrCodeTool />);

    fireEvent.click(screen.getByRole('button', { name: /解析二维码/i }));
    const file = new File(['text'], 'note.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText('请上传图片文件')).toBeInTheDocument();
    });
  });
});
