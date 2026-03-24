import type { CustomRuleInput, MaskRule } from './types';

let customRuleCounter = 0;

function nextCustomRuleId() {
  customRuleCounter += 1;
  return `custom_${customRuleCounter}`;
}

export function createCustomRule(input: CustomRuleInput): { error?: string; rule?: MaskRule } {
  if (!input.name.trim() || !input.pattern.trim()) {
    return {
      error: '名称和正则表达式不能为空',
    };
  }

  try {
    const pattern = new RegExp(input.pattern, 'g');
    const replacement = input.replacement.trim() || '***';

    return {
      rule: {
        id: nextCustomRuleId(),
        name: input.name.trim(),
        enabled: true,
        builtin: false,
        pattern,
        mask: () => replacement,
      },
    };
  } catch {
    return {
      error: '正则表达式语法错误',
    };
  }
}
