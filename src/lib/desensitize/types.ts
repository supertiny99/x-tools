export type AddressLevel = 'province' | 'district' | 'street';

export interface MaskRule {
  id: string;
  name: string;
  enabled: boolean;
  builtin: boolean;
  pattern: RegExp;
  mask: (match: string) => string;
}

export interface MatchInfo {
  start: number;
  end: number;
  original: string;
  masked: string;
}

export interface DesensitizeResult {
  output: string;
  matches: MatchInfo[];
  matchCount: number;
}

export interface LineData {
  segments: { text: string; hl: boolean }[];
  changed: boolean;
}

export interface CustomRuleInput {
  name: string;
  pattern: string;
  replacement: string;
}
