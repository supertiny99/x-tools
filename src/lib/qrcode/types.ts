export type ImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type QrGenerateResult =
  | { kind: 'empty' }
  | { kind: 'success'; dataUrl: string }
  | { kind: 'error'; message: string };

export type QrParseResult =
  | { kind: 'success'; text: string; previewUrl: string }
  | { kind: 'error'; message: string; previewUrl?: string };

export type QrGenerateDeps = {
  toDataURL: (text: string, options: object) => Promise<string>;
};

export type QrParseDeps = {
  decodeImageFile: (file: File) => Promise<{ previewUrl: string; imageData: ImageDataLike }>;
  scanQrCode: (imageData: ImageDataLike) => { data: string } | null;
};
