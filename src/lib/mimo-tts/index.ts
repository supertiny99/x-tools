export const MIMO_TTS_API_URL = 'https://api.xiaomimimo.com/v1/chat/completions';

export const MIMO_TTS_MODEL = 'mimo-v2-tts';

export const MIMO_TTS_VOICES = ['mimo_default', 'default_zh', 'default_en'] as const;

export const MIMO_TTS_FORMATS = ['wav', 'mp3', 'pcm'] as const;

export type MimoTtsVoice = (typeof MIMO_TTS_VOICES)[number];
export type MimoTtsFormat = (typeof MIMO_TTS_FORMATS)[number];

export interface ComposeStyledAssistantTextInput {
  style: string;
  text: string;
}

export interface BuildMimoTtsRequestInput extends ComposeStyledAssistantTextInput {
  userContext?: string;
  voice: MimoTtsVoice;
  format: MimoTtsFormat;
}

export interface MimoAudioPayload {
  base64: string;
  format: string;
}

interface AudioResponseShape {
  data?: string;
  format?: string;
  mime_type?: string;
  mimeType?: string;
}

export function composeStyledAssistantText(input: ComposeStyledAssistantTextInput): string {
  const text = input.text.trim();
  const style = input.style.trim();

  if (!style) {
    return text;
  }

  return `<style>${style}</style>${text}`;
}

export function buildMimoTtsRequestBody(input: BuildMimoTtsRequestInput) {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const userContext = input.userContext?.trim();

  if (userContext) {
    messages.push({
      role: 'user',
      content: userContext,
    });
  }

  messages.push({
    role: 'assistant',
    content: composeStyledAssistantText({
      style: input.style,
      text: input.text,
    }),
  });

  return {
    model: MIMO_TTS_MODEL,
    messages,
    audio: {
      voice: input.voice,
      format: input.format,
    },
    temperature: 0.6,
    stream: false,
  };
}

export function extractAudioPayload(response: unknown): MimoAudioPayload {
  const payload = response as {
    audio?: AudioResponseShape;
    data?: string;
    format?: string;
    choices?: Array<{
      message?: {
        audio?: AudioResponseShape;
      };
    }>;
  };

  const audio =
    payload.choices?.[0]?.message?.audio ??
    payload.audio ??
    (payload.data ? { data: payload.data, format: payload.format } : undefined);

  if (!audio?.data) {
    throw new Error('未在响应中找到音频数据');
  }

  return {
    base64: audio.data,
    format: audio.format ?? 'wav',
  };
}

export function getAudioMimeType(format: string): string {
  switch (format) {
    case 'mp3':
      return 'audio/mpeg';
    case 'pcm':
    case 'pcm16':
      return 'audio/pcm';
    case 'wav':
    default:
      return 'audio/wav';
  }
}

export function decodeBase64AudioToBlob(base64: string, format: string): Blob {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new Blob([bytes], {
    type: getAudioMimeType(format),
  });
}
