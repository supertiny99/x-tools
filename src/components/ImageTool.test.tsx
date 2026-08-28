import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ImageTool from './ImageTool';

describe('ImageTool', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('Image', class {
      width = 1000;
      height = 1500;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
    });
  });

  test('shows poster QR replacement controls in the image tool', () => {
    render(<ImageTool />);

    fireEvent.click(screen.getByRole('button', { name: /二维码替换/i }));

    expect(screen.getByText('上传海报底图')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /添加二维码/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /粘贴图片/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /导出 PNG/i })).toBeDisabled();
  });

  test('undo shortcut removes the last added QR layer', async () => {
    const { container } = render(<ImageTool />);

    fireEvent.click(screen.getByRole('button', { name: /二维码替换/i }));
    const inputs = container.querySelectorAll('input[type="file"]');

    fireEvent.change(inputs[0], {
      target: { files: [new File(['poster'], 'poster.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByText(/poster.png/)).toBeInTheDocument());

    fireEvent.change(inputs[1], {
      target: { files: [new File(['qr'], 'qr.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByText('1 个')).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByText('暂无二维码图层')).toBeInTheDocument();
    });
  });

  test('allows clearing QR width and height before typing a new value', async () => {
    const { container } = render(<ImageTool />);

    fireEvent.click(screen.getByRole('button', { name: /二维码替换/i }));
    const inputs = container.querySelectorAll('input[type="file"]');

    fireEvent.change(inputs[0], {
      target: { files: [new File(['poster'], 'poster.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByText(/poster.png/)).toBeInTheDocument());

    fireEvent.change(inputs[1], {
      target: { files: [new File(['qr'], 'qr.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByText('1 个')).toBeInTheDocument());

    const widthInput = screen.getByLabelText('宽') as HTMLInputElement;
    const heightInput = screen.getByLabelText('高') as HTMLInputElement;

    fireEvent.change(widthInput, { target: { value: '' } });
    fireEvent.change(heightInput, { target: { value: '' } });

    expect(widthInput.value).toBe('');
    expect(heightInput.value).toBe('');
  });
});
