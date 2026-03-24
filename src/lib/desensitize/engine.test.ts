import { describe, expect, test } from 'vitest';

import { desensitizeText } from './engine';
import { createBuiltinRules } from './rules';

function onlyRules(ruleIds: string[]) {
  return createBuiltinRules({ addressLevel: 'street' }).map((rule) => ({
    ...rule,
    enabled: ruleIds.includes(rule.id),
  }));
}

describe('desensitizeText', () => {
  test('returns masked output for enabled rules', () => {
    const result = desensitizeText('手机号 13812345678，邮箱 zhangsan@example.com', onlyRules(['phone', 'email']));

    expect(result.output).toBe('手机号 138****5678，邮箱 z***@example.com');
  });

  test('counts matches across multiple rules', () => {
    const result = desensitizeText('13812345678 和 15698765432', onlyRules(['phone']));

    expect(result.matchCount).toBe(2);
  });

  test('returns match positions and values', () => {
    const result = desensitizeText('联系方式 13812345678', onlyRules(['phone']));

    expect(result.matches).toEqual([
      {
        start: 5,
        end: 16,
        original: '13812345678',
        masked: '138****5678',
      },
    ]);
  });

  test('keeps original text when no enabled rules match', () => {
    const input = '这是一段普通文本';
    const result = desensitizeText(input, onlyRules(['phone']));

    expect(result.output).toBe(input);
    expect(result.matchCount).toBe(0);
    expect(result.matches).toEqual([]);
  });
});
