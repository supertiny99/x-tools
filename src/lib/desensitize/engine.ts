import type { DesensitizeResult, MaskRule, MatchInfo } from './types';

export function desensitizeText(input: string, rules: MaskRule[]): DesensitizeResult {
  if (!input) {
    return {
      output: '',
      matches: [],
      matchCount: 0,
    };
  }

  const allMatches: (MatchInfo & { ruleIndex: number })[] = [];

  for (const [ruleIndex, rule] of rules.entries()) {
    if (!rule.enabled) continue;

    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        original: match[0],
        masked: rule.mask(match[0]),
        ruleIndex,
      });

      if (!regex.global) break;
    }
  }

  allMatches.sort((left, right) => left.start - right.start || left.ruleIndex - right.ruleIndex);

  const matches: MatchInfo[] = [];
  let lastEnd = 0;

  for (const match of allMatches) {
    if (match.start < lastEnd) continue;

    matches.push({
      start: match.start,
      end: match.end,
      original: match.original,
      masked: match.masked,
    });
    lastEnd = match.end;
  }

  let output = '';
  let position = 0;

  for (const match of matches) {
    output += input.slice(position, match.start);
    output += match.masked;
    position = match.end;
  }

  output += input.slice(position);

  return {
    output,
    matches,
    matchCount: matches.length,
  };
}
