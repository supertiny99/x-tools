import React, { useState, useCallback, useRef } from 'react';
import { FiShield, FiCopy, FiCheck, FiTrash2, FiPlus, FiX, FiChevronDown } from 'react-icons/fi';

interface MaskRule {
  id: string;
  name: string;
  enabled: boolean;
  builtin: boolean;
  pattern: RegExp;
  mask: (match: string) => string;
}

// 常见中文姓氏（精简高频集，减少误匹配）
const CN_SURNAMES = '王李张刘陈杨黄赵周吴徐孙马胡朱郭何罗高梁郑谢宋唐韩曹许邓冯曾蔡彭潘袁董余苏叶吕蒋田丁沈姜范江傅钟卢汪戴崔任陆廖姚方金邱谭韦贾邹熊孟秦阎薛侯雷龙段郝邵毛';
const NAME_RE = new RegExp(`(?<=[\\s，。！？、；：""''（）《》\\n]|^)[${CN_SURNAMES}][\\u4e00-\\u9fa5]{1,2}(?=[\\s，。！？、；：""''（）《》先女男老小同\\n]|$)`, 'gm');

const builtinRules: MaskRule[] = [
  {
    id: 'phone',
    name: '手机号',
    enabled: true,
    builtin: true,
    pattern: /(?<!\d)(1[3-9]\d)\d{4}(\d{4})(?!\d)/g,
    mask: (m) => {
      const match = /^(1[3-9]\d)\d{4}(\d{4})$/.exec(m);
      return match ? `${match[1]}****${match[2]}` : m;
    },
  },
  {
    id: 'idcard',
    name: '身份证号',
    enabled: true,
    builtin: true,
    pattern: /(?<!\d)(\d{6})\d{8}(\d{3}[\dXx])(?!\d)/g,
    mask: (m) => {
      const match = /^(\d{6})\d{8}(\d{3}[\dXx])$/.exec(m);
      return match ? `${match[1]}********${match[2]}` : m;
    },
  },
  {
    id: 'email',
    name: '邮箱地址',
    enabled: true,
    builtin: true,
    pattern: /([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    mask: (m) => {
      const match = /^([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/.exec(m);
      return match ? `${match[1]}***${match[2]}` : m;
    },
  },
  {
    id: 'bankcard',
    name: '银行卡号',
    enabled: true,
    builtin: true,
    pattern: /(?<!\d)(\d{4})\d{4,12}(\d{4})(?!\d)/g,
    mask: (m) => {
      const match = /^(\d{4})\d{4,12}(\d{4})$/.exec(m);
      return match ? `${match[1]}****${match[2]}` : m;
    },
  },
  {
    id: 'name_cn',
    name: '中文姓名',
    enabled: true,
    builtin: true,
    pattern: NAME_RE,
    mask: (m) => {
      if (m.length === 2) return m[0] + '*';
      if (m.length === 3) return m[0] + '*' + m[2];
      if (m.length === 4) return m[0] + '**' + m[3];
      return m[0] + '*'.repeat(m.length - 2) + m[m.length - 1];
    },
  },
  {
    id: 'ipv4',
    name: 'IPv4 地址',
    enabled: true,
    builtin: true,
    pattern: /(?<!\d)(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}(?!\d)/g,
    mask: (m) => {
      const match = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(m);
      return match ? `${match[1]}.${match[2]}.*.*` : m;
    },
  },
  {
    id: 'address',
    name: '详细地址',
    enabled: true,
    builtin: true,
    // 要求：至少包含街道名+门牌号数字，避免匹配普通中文
    pattern: /((?:[\u4e00-\u9fa5]+(?:省|自治区))?(?:[\u4e00-\u9fa5]+(?:市|州|盟))?(?:[\u4e00-\u9fa5]+(?:区|县|旗|镇|乡))?)([\u4e00-\u9fa5]{2,}(?:路|街道?|大道|大街|巷|弄|胡同|里|村))(\d[\u4e00-\u9fa5\d]*(?:号院?|栋|幢|楼|单元|层|室)[\u4e00-\u9fa5\d]*)/g,
    mask: (m) => m, // placeholder, overridden at runtime
  },
];

type AddressLevel = 'province' | 'district' | 'street';
const ADDRESS_LEVELS: { value: AddressLevel; label: string }[] = [
  { value: 'province', label: '省/市级' },
  { value: 'district', label: '区/县级' },
  { value: 'street', label: '街道级' },
];

interface CustomRuleInput {
  name: string;
  pattern: string;
  replacement: string;
}

const DEMO_TEXT = `尊敬的 张三 先生，您好！

您的订单已确认，以下是您的个人信息核对：
- 手机号：13812345678
- 备用手机：15698765432
- 身份证号：110101199003076514
- 邮箱：zhangsan@example.com
- 银行卡号：6222021234561234567
- 收货地址：北京市朝阳区建国路88号院5号楼3单元502室
- 访问IP：192.168.1.100

如有疑问请联系客服 李四 lisi@company.cn 或拨打 18600001111。

此信息仅供核对，请勿转发。`;

export default function DesensitizeTool() {
  const [rules, setRules] = useState<MaskRule[]>(builtinRules);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [showCustom, setShowCustom] = useState(false);
  const [addressLevel, setAddressLevel] = useState<AddressLevel>('street');
  const addressLevelRef = useRef<AddressLevel>('street');
  const [customRule, setCustomRule] = useState<CustomRuleInput>({
    name: '',
    pattern: '',
    replacement: '***',
  });
  const [customError, setCustomError] = useState('');

  const changeAddressLevel = useCallback((level: AddressLevel) => {
    setAddressLevel(level);
    addressLevelRef.current = level;
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addCustomRule = useCallback(() => {
    if (!customRule.name.trim() || !customRule.pattern.trim()) {
      setCustomError('名称和正则表达式不能为空');
      return;
    }
    try {
      const regex = new RegExp(customRule.pattern, 'g');
      const replacement = customRule.replacement;
      const newRule: MaskRule = {
        id: `custom_${Date.now()}`,
        name: customRule.name,
        enabled: true,
        builtin: false,
        pattern: regex,
        mask: () => replacement,
      };
      setRules((prev) => [...prev, newRule]);
      setCustomRule({ name: '', pattern: '', replacement: '***' });
      setCustomError('');
      setShowCustom(false);
    } catch {
      setCustomError('正则表达式语法错误');
    }
  }, [customRule]);

  const doMask = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setMatchCount(0);
      return;
    }

    const addressMask = (m: string) => {
      // group 1: admin prefix (省市区), group 2: street name, group 3: detail (number+building)
      const re = /((?:[\u4e00-\u9fa5]+(?:省|自治区))?(?:[\u4e00-\u9fa5]+(?:市|州|盟))?)((?:[\u4e00-\u9fa5]+(?:区|县|旗|镇|乡))?)([\u4e00-\u9fa5]+(?:路|街道?|大道|大街|巷|弄|胡同|里|村))?/;
      const parts = re.exec(m);
      if (!parts) return m;
      const [, admin = '', district = '', street = ''] = parts;
      const level = addressLevelRef.current;
      if (level === 'province') return (admin || district) + '****';
      if (level === 'district') return admin + district + '****';
      return admin + district + street + '****';
    };

    let result = input;
    let total = 0;

    for (const rule of rules) {
      if (!rule.enabled) continue;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      const matches = result.match(regex);
      if (matches) {
        total += matches.length;
        const maskFn = rule.id === 'address' ? addressMask : rule.mask;
        result = result.replace(regex, (m) => maskFn(m));
      }
    }

    setOutput(result);
    setMatchCount(total);
  }, [input, rules]);

  const copyOutput = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const clearAll = useCallback(() => {
    setInput('');
    setOutput('');
    setMatchCount(0);
  }, []);

  const loadDemo = useCallback(() => {
    setInput(DEMO_TEXT);
    setOutput('');
    setMatchCount(0);
  }, []);

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-transparent min-h-[600px]">
      {/* 左侧规则面板 */}
      <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700/50 p-5 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center gap-2 mb-1">
          <FiShield className="text-brand-600 dark:text-brand-400" size={18} />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            脱敏规则
          </h2>
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
            {enabledCount}/{rules.length} 启用
          </span>
        </div>

        <div className="flex flex-col gap-1.5 flex-grow overflow-y-auto">
          {rules.map((rule) => (
            <div key={rule.id}>
              <label
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors hover:bg-white dark:hover:bg-slate-800/50 group"
              >
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300 flex-grow">
                  {rule.name}
                </span>
                {!rule.builtin && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeRule(rule.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all"
                    title="删除规则"
                  >
                    <FiX size={14} />
                  </button>
                )}
              </label>
              {rule.id === 'address' && rule.enabled && (
                <div className="ml-9 mr-3 mt-1 mb-1.5">
                  <div className="relative">
                    <select
                      value={addressLevel}
                      onChange={(e) => changeAddressLevel(e.target.value as AddressLevel)}
                      className="w-full appearance-none px-2.5 py-1 pr-7 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                    >
                      {ADDRESS_LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                    <FiChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 自定义规则 */}
        {showCustom ? (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2.5 bg-white dark:bg-slate-800/50">
            <input
              type="text"
              placeholder="规则名称"
              value={customRule.name}
              onChange={(e) => setCustomRule((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="text"
              placeholder="正则表达式（不含 /）"
              value={customRule.pattern}
              onChange={(e) => setCustomRule((p) => ({ ...p, pattern: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="text"
              placeholder="替换为（默认 ***）"
              value={customRule.replacement}
              onChange={(e) => setCustomRule((p) => ({ ...p, replacement: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {customError && (
              <p className="text-xs text-red-500">{customError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={addCustomRule}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                添加
              </button>
              <button
                onClick={() => {
                  setShowCustom(false);
                  setCustomError('');
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-sm font-medium rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            <FiPlus size={14} />
            自定义规则
          </button>
        )}
      </div>

      {/* 右侧主内容 */}
      <div className="flex-grow flex flex-col p-5 md:p-8 gap-5">
        {/* 输入区 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              原始文本
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={loadDemo}
                className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
              >
                加载示例
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                <FiTrash2 size={12} />
                清空
              </button>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'请输入需要脱敏的文本...\n\n示例：\n张三的手机号是 13812345678，身份证号 110101199001011234\n邮箱 zhangsan@example.com，银行卡 6222021234561234567'}
            className="flex-1 w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            spellCheck={false}
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={doMask}
            disabled={!input.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
          >
            <FiShield size={16} />
            执行脱敏
          </button>
          {matchCount > 0 && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
              已匹配并脱敏 {matchCount} 处
            </span>
          )}
        </div>

        {/* 输出区 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              脱敏结果
            </label>
            <button
              onClick={copyOutput}
              disabled={!output}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors disabled:opacity-30"
            >
              {copied ? <FiCheck size={12} className="text-emerald-500" /> : <FiCopy size={12} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="脱敏后的文本将显示在此处..."
            className="flex-1 w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/20 text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-mono resize-none focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
