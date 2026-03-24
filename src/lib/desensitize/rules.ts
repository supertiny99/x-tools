import type { AddressLevel, MaskRule } from './types';

const CN_SURNAMES = '王李张刘陈杨黄赵周吴徐孙马胡朱郭何罗高梁郑谢宋唐韩曹许邓冯曾蔡彭潘袁董余苏叶吕蒋田丁沈姜范江傅钟卢汪戴崔任陆廖姚方金邱谭韦贾邹熊孟秦阎薛侯雷龙段郝邵毛';
const NAME_RE = new RegExp(`(?<=[\\s，。！？、；：""''（）《》\\n]|^)[${CN_SURNAMES}][\\u4e00-\\u9fa5]{1,2}(?=[\\s，。！？、；：""''（）《》先女男老小同\\n]|$)`, 'gm');
const ADDRESS_PATTERN = /((?:[\u4e00-\u9fa5]+(?:省|自治区))?(?:[\u4e00-\u9fa5]+(?:市|州|盟))?(?:[\u4e00-\u9fa5]+(?:区|县|旗|镇|乡))?)([\u4e00-\u9fa5]{2,}(?:路|街道?|大道|大街|巷|弄|胡同|里|村))(\d[\u4e00-\u9fa5\d]*(?:号院?|栋|幢|楼|单元|层|室)[\u4e00-\u9fa5\d]*)/g;
const ADDRESS_PARTS_RE = /((?:[\u4e00-\u9fa5]+(?:省|自治区))?(?:[\u4e00-\u9fa5]+(?:市|州|盟))?)((?:[\u4e00-\u9fa5]+(?:区|县|旗|镇|乡))?)([\u4e00-\u9fa5]+(?:路|街道?|大道|大街|巷|弄|胡同|里|村))?/;

function maskChineseName(name: string) {
  if (name.length === 2) return `${name[0]}*`;
  if (name.length === 3) return `${name[0]}*${name[2]}`;
  if (name.length === 4) return `${name[0]}**${name[3]}`;
  return `${name[0]}${'*'.repeat(Math.max(0, name.length - 2))}${name[name.length - 1]}`;
}

function maskAddress(address: string, level: AddressLevel) {
  const parts = ADDRESS_PARTS_RE.exec(address);

  if (!parts) return address;

  const [, admin = '', district = '', street = ''] = parts;

  if (level === 'province') return `${admin || district}****`;
  if (level === 'district') return `${admin}${district}****`;

  return `${admin}${district}${street}****`;
}

export function createBuiltinRules(options: { addressLevel: AddressLevel }): MaskRule[] {
  return [
    {
      id: 'phone',
      name: '手机号',
      enabled: true,
      builtin: true,
      pattern: /(?<!\d)(1[3-9]\d)\d{4}(\d{4})(?!\d)/g,
      mask: (match) => {
        const groups = /^(1[3-9]\d)\d{4}(\d{4})$/.exec(match);
        return groups ? `${groups[1]}****${groups[2]}` : match;
      },
    },
    {
      id: 'idcard',
      name: '身份证号',
      enabled: true,
      builtin: true,
      pattern: /(?<!\d)(\d{6})\d{8}(\d{3}[\dXx])(?!\d)/g,
      mask: (match) => {
        const groups = /^(\d{6})\d{8}(\d{3}[\dXx])$/.exec(match);
        return groups ? `${groups[1]}********${groups[2]}` : match;
      },
    },
    {
      id: 'email',
      name: '邮箱地址',
      enabled: true,
      builtin: true,
      pattern: /([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      mask: (match) => {
        const groups = /^([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/.exec(match);
        return groups ? `${groups[1]}***${groups[2]}` : match;
      },
    },
    {
      id: 'bankcard',
      name: '银行卡号',
      enabled: true,
      builtin: true,
      pattern: /(?<!\d)(\d{4})\d{4,12}(\d{4})(?!\d)/g,
      mask: (match) => {
        const groups = /^(\d{4})\d{4,12}(\d{4})$/.exec(match);
        return groups ? `${groups[1]}****${groups[2]}` : match;
      },
    },
    {
      id: 'name_cn',
      name: '中文姓名',
      enabled: true,
      builtin: true,
      pattern: NAME_RE,
      mask: maskChineseName,
    },
    {
      id: 'ipv4',
      name: 'IPv4 地址',
      enabled: true,
      builtin: true,
      pattern: /(?<!\d)(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}(?!\d)/g,
      mask: (match) => {
        const groups = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(match);
        return groups ? `${groups[1]}.${groups[2]}.*.*` : match;
      },
    },
    {
      id: 'address',
      name: '详细地址',
      enabled: true,
      builtin: true,
      pattern: ADDRESS_PATTERN,
      mask: (match) => maskAddress(match, options.addressLevel),
    },
  ];
}
