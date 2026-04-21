import { describe, expect, test } from 'vitest';

import {
  buildMimoTtsRequestBody,
  composeStyledAssistantText,
  decodeBase64AudioToBlob,
  extractAudioPayload,
} from './index';

describe('mimo tts helpers', () => {
  test('builds assistant text with style prefix and inline tag content', () => {
    expect(
      composeStyledAssistantText({
        style: '温柔、缓慢、略带耳语',
        text: '今天辛苦了。（轻轻停顿）先休息一下吧。',
      }),
    ).toBe('<style>温柔、缓慢、略带耳语</style>今天辛苦了。（轻轻停顿）先休息一下吧。');
  });

  test('returns plain text when style is empty', () => {
    expect(
      composeStyledAssistantText({
        style: '   ',
        text: '直接朗读这句话。',
      }),
    ).toBe('直接朗读这句话。');
  });

  test('builds mimo request body with optional user context and audio config', () => {
    expect(
      buildMimoTtsRequestBody({
        userContext: '请用安抚语气回应用户。',
        style: '沉稳、温柔',
        text: '别担心，我们一步一步来。',
        voice: 'default_zh',
        format: 'mp3',
      }),
    ).toEqual({
      model: 'mimo-v2-tts',
      messages: [
        {
          role: 'user',
          content: '请用安抚语气回应用户。',
        },
        {
          role: 'assistant',
          content: '<style>沉稳、温柔</style>别担心，我们一步一步来。',
        },
      ],
      audio: {
        voice: 'default_zh',
        format: 'mp3',
      },
      temperature: 0.6,
      stream: false,
    });
  });

  test('extracts audio payload from openai-compatible response', () => {
    expect(
      extractAudioPayload({
        choices: [
          {
            message: {
              audio: {
                data: 'Zm9v',
                format: 'wav',
              },
            },
          },
        ],
      }),
    ).toEqual({
      base64: 'Zm9v',
      format: 'wav',
    });
  });

  test('extracts fallback audio payload keys', () => {
    expect(
      extractAudioPayload({
        data: 'YmFy',
        format: 'mp3',
      }),
    ).toEqual({
      base64: 'YmFy',
      format: 'mp3',
    });
  });

  test('throws when response does not contain audio payload', () => {
    expect(() => extractAudioPayload({ choices: [] })).toThrow('未在响应中找到音频数据');
  });

  test('decodes base64 audio into a blob with matching mime type', async () => {
    const blob = decodeBase64AudioToBlob('aGVsbG8=', 'mp3');

    expect(blob.type).toBe('audio/mpeg');
    expect(blob.size).toBe(5);
  });
});
