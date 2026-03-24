import type { LineData, MatchInfo } from './types';

export function textToLineData(text: string, ranges: { start: number; end: number }[]): LineData[] {
  const lines = text.split('\n');
  const result: LineData[] = [];
  let charOffset = 0;
  let rangeIndex = 0;

  for (const line of lines) {
    const lineStart = charOffset;
    const lineEnd = charOffset + line.length;
    const segments: { text: string; hl: boolean }[] = [];
    let linePos = lineStart;
    let changed = false;

    while (rangeIndex < ranges.length && ranges[rangeIndex].start < lineEnd) {
      const range = ranges[rangeIndex];

      if (range.start > linePos) {
        segments.push({ text: text.slice(linePos, range.start), hl: false });
      }

      segments.push({ text: text.slice(range.start, range.end), hl: true });
      changed = true;
      linePos = range.end;
      rangeIndex += 1;
    }

    if (linePos < lineEnd) {
      segments.push({ text: text.slice(linePos, lineEnd), hl: false });
    }

    if (segments.length === 0) {
      segments.push({ text: '', hl: false });
    }

    result.push({ segments, changed });
    charOffset = lineEnd + 1;
  }

  return result;
}

export function buildDiffData(input: string, matches: MatchInfo[]) {
  const oldRanges = matches.map((match) => ({
    start: match.start,
    end: match.end,
  }));

  let output = '';
  let sourcePos = 0;
  const newRanges: { start: number; end: number }[] = [];

  for (const match of matches) {
    output += input.slice(sourcePos, match.start);
    const newStart = output.length;
    output += match.masked;
    newRanges.push({ start: newStart, end: newStart + match.masked.length });
    sourcePos = match.end;
  }

  output += input.slice(sourcePos);

  return {
    oldLines: textToLineData(input, oldRanges),
    newLines: textToLineData(output, newRanges),
  };
}
