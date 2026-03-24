import { describe, expect, test } from 'vitest';

import { createBuiltinRules } from './rules';

describe('createBuiltinRules', () => {
  test('phone rule masks middle digits', () => {
    const phoneRule = createBuiltinRules({ addressLevel: 'street' }).find((rule) => rule.id === 'phone');

    expect(phoneRule?.mask('13812345678')).toBe('138****5678');
  });

  test('email rule preserves first char and domain', () => {
    const emailRule = createBuiltinRules({ addressLevel: 'street' }).find((rule) => rule.id === 'email');

    expect(emailRule?.mask('zhangsan@example.com')).toBe('z***@example.com');
  });

  test('name rule masks common chinese names by length', () => {
    const nameRule = createBuiltinRules({ addressLevel: 'street' }).find((rule) => rule.id === 'name_cn');

    expect(nameRule?.mask('张三')).toBe('张*');
    expect(nameRule?.mask('张小明')).toBe('张*明');
    expect(nameRule?.mask('欧阳娜娜')).toBe('欧**娜');
  });

  test('ipv4 rule masks last two octets', () => {
    const ipv4Rule = createBuiltinRules({ addressLevel: 'street' }).find((rule) => rule.id === 'ipv4');

    expect(ipv4Rule?.mask('192.168.1.100')).toBe('192.168.*.*');
  });

  test('address rule output changes by address level', () => {
    const address = '北京市朝阳区建国路88号院5号楼3单元502室';

    const provinceRule = createBuiltinRules({ addressLevel: 'province' }).find((rule) => rule.id === 'address');
    const districtRule = createBuiltinRules({ addressLevel: 'district' }).find((rule) => rule.id === 'address');
    const streetRule = createBuiltinRules({ addressLevel: 'street' }).find((rule) => rule.id === 'address');

    expect(provinceRule?.mask(address)).toBe('北京市****');
    expect(districtRule?.mask(address)).toBe('北京市朝阳区****');
    expect(streetRule?.mask(address)).toBe('北京市朝阳区建国路****');
  });
});
