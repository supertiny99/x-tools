import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import DesensitizeTool from './DesensitizeTool';

describe('DesensitizeTool', () => {
  test('masks enabled rules and shows match count after clicking run', () => {
    render(<DesensitizeTool />);

    fireEvent.change(screen.getByPlaceholderText(/请输入需要脱敏的文本/i), {
      target: { value: '联系人 张三，手机号 13812345678' },
    });

    fireEvent.click(screen.getByRole('button', { name: '执行脱敏' }));

    expect(screen.getByText((_, element) => element?.textContent === '已匹配并脱敏 2 处')).toBeInTheDocument();
    expect(screen.getByText('138****5678')).toBeInTheDocument();
    expect(screen.getByText('张*')).toBeInTheDocument();
  });

  test('changes address masking output when address level changes', () => {
    render(<DesensitizeTool />);

    fireEvent.change(screen.getByPlaceholderText(/请输入需要脱敏的文本/i), {
      target: { value: '收货地址：北京市朝阳区建国路88号院5号楼3单元502室' },
    });

    fireEvent.change(screen.getByDisplayValue('街道级'), {
      target: { value: 'province' },
    });

    fireEvent.click(screen.getByRole('button', { name: '执行脱敏' }));

    expect(screen.getByText('北京市****')).toBeInTheDocument();
    expect(screen.queryByText('北京市朝阳区建国路****')).not.toBeInTheDocument();
  });

  test('shows validation error when custom regexp is invalid', () => {
    render(<DesensitizeTool />);

    fireEvent.click(screen.getByRole('button', { name: /自定义规则/i }));
    fireEvent.change(screen.getByPlaceholderText('规则名称'), {
      target: { value: '坏规则' },
    });
    fireEvent.change(screen.getByPlaceholderText('正则表达式（不含 /）'), {
      target: { value: '[abc' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(screen.getByText('正则表达式语法错误')).toBeInTheDocument();
    expect(screen.queryByText('坏规则')).not.toBeInTheDocument();
  });

  test('uses added custom rule during masking', () => {
    render(<DesensitizeTool />);

    fireEvent.click(screen.getByRole('button', { name: /自定义规则/i }));
    fireEvent.change(screen.getByPlaceholderText('规则名称'), {
      target: { value: '工号' },
    });
    fireEvent.change(screen.getByPlaceholderText('正则表达式（不含 /）'), {
      target: { value: 'EMP\\d+' },
    });
    fireEvent.change(screen.getByPlaceholderText('替换为（默认 ***）'), {
      target: { value: '已隐藏' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    fireEvent.change(screen.getByPlaceholderText(/请输入需要脱敏的文本/i), {
      target: { value: '员工工号 EMP123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '执行脱敏' }));

    expect(screen.getByText('已隐藏')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === '已匹配并脱敏 1 处')).toBeInTheDocument();
  });
});
