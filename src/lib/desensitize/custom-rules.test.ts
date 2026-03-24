import { describe, expect, test } from 'vitest';

import { createCustomRule } from './custom-rules';

describe('createCustomRule', () => {
  test('returns an error when name or pattern is empty', () => {
    expect(createCustomRule({ name: '', pattern: '', replacement: '***' })).toEqual({
      error: '名称和正则表达式不能为空',
    });
  });

  test('returns an error when pattern is not a valid regexp', () => {
    expect(createCustomRule({ name: '手机号后四位', pattern: '[abc', replacement: '***' })).toEqual({
      error: '正则表达式语法错误',
    });
  });

  test('creates an enabled custom rule with global regexp and replacement mask', () => {
    const result = createCustomRule({
      name: '工号',
      pattern: 'EMP\\d+',
      replacement: '已隐藏',
    });

    expect(result.error).toBeUndefined();
    expect(result.rule).toMatchObject({
      id: 'custom_1',
      name: '工号',
      enabled: true,
      builtin: false,
    });
    expect(result.rule?.pattern.source).toBe('EMP\\d+');
    expect(result.rule?.pattern.flags).toBe('g');
    expect(result.rule?.mask('EMP123')).toBe('已隐藏');
  });

  test('uses default replacement when custom replacement is blank', () => {
    const result = createCustomRule({
      name: '订单号',
      pattern: 'ORD\\d+',
      replacement: '   ',
    });

    expect(result.rule?.mask('ORD123')).toBe('***');
  });
});
