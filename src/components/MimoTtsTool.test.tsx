import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import MimoTtsTool from './MimoTtsTool';

describe('MimoTtsTool', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                audio: {
                  data: 'aGVsbG8=',
                  format: 'mp3',
                },
              },
            },
          ],
        }),
      }),
    );

    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:mimo-audio'),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  test('submits MiMo request and shows generated audio player', async () => {
    render(<MimoTtsTool />);

    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'sk-test-123' },
    });
    fireEvent.change(screen.getByLabelText('整体风格'), {
      target: { value: '温柔、缓慢、略带耳语' },
    });
    fireEvent.change(screen.getByLabelText('待合成文本'), {
      target: { value: '今天辛苦了。（轻轻停顿）先休息一下吧。' },
    });

    fireEvent.click(screen.getByRole('button', { name: '生成音频' }));

    await waitFor(() => {
      expect(screen.getByText('生成完成')).toBeInTheDocument();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.xiaomimimo.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'api-key': 'sk-test-123',
        }),
      }),
    );

    const fetchMock = vi.mocked(globalThis.fetch);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));

    expect(body).toEqual(
      expect.objectContaining({
        model: 'mimo-v2-tts',
        messages: [
          {
            role: 'assistant',
            content: '<style>温柔、缓慢、略带耳语</style>今天辛苦了。（轻轻停顿）先休息一下吧。',
          },
        ],
      }),
    );

    expect(screen.getByLabelText('生成结果音频')).toHaveAttribute('src', 'blob:mimo-audio');
  });

  test('renders official style and tag examples and applies them on click', () => {
    render(<MimoTtsTool />);

    expect(screen.getByText('语音整体风格控制写法')).toBeInTheDocument();
    expect(screen.getByText('语速控制')).toBeInTheDocument();
    expect(screen.getByText('开心')).toBeInTheDocument();
    expect(screen.getByText('音频标签细粒度控制样例')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /<style>粤语<\/style>呢个真係好正啊！食过一次就唔会忘记！/i }));

    expect(screen.getByLabelText('整体风格')).toHaveValue('粤语');
    expect(screen.getByLabelText('待合成文本')).toHaveValue('呢个真係好正啊！食过一次就唔会忘记！');

    fireEvent.click(screen.getByRole('button', { name: /如果我当时/ }));

    expect(screen.getByLabelText('待合成文本')).toHaveValue(
      '如果我当时……（沉默片刻）哪怕再坚持一秒钟，结果是不是就不一样了？（苦笑）呵，没如果了。',
    );
  });
});
