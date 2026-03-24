import { describe, expect, test } from 'vitest';

import { buildDiffData, textToLineData } from './diff';

describe('textToLineData', () => {
  test('marks matched segments as highlighted within a line', () => {
    const lines = textToLineData('手机号 138****5678', [{ start: 4, end: 12 }]);

    expect(lines).toEqual([
      {
        changed: true,
        segments: [
          { text: '手机号 ', hl: false },
          { text: '138****5', hl: true },
          { text: '678', hl: false },
        ],
      },
    ]);
  });
});

describe('buildDiffData', () => {
  test('builds old and new line highlights from desensitize matches', () => {
    const diff = buildDiffData('联系人 张三，手机号 13812345678', [
      {
        start: 4,
        end: 6,
        original: '张三',
        masked: '张*',
      },
      {
        start: 12,
        end: 23,
        original: '13812345678',
        masked: '138****5678',
      },
    ]);

    expect(diff.oldLines[0].changed).toBe(true);
    expect(diff.newLines[0].changed).toBe(true);
    expect(diff.oldLines[0].segments.some((segment) => segment.text === '张三' && segment.hl)).toBe(true);
    expect(diff.newLines[0].segments.some((segment) => segment.text === '张*' && segment.hl)).toBe(true);
    expect(diff.newLines[0].segments.some((segment) => segment.text === '138****5678' && segment.hl)).toBe(true);
  });
});
