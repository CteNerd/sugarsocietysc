export function sqlSegments(sql: string): Array<{ text: string; code: boolean }> {
  const segments: Array<{ text: string; code: boolean }> = [];
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    const quote = sql[i];
    const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
    const lineComment = sql.startsWith('--', i);
    const blockComment = sql.startsWith('/*', i);
    if (quote !== "'" && quote !== '"' && !dollar && !lineComment && !blockComment) {
      i += 1;
      continue;
    }
    if (i > start) segments.push({ text: sql.slice(start, i), code: true });
    const literalStart = i;
    if (lineComment) {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end + 1;
    } else if (blockComment) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql.startsWith('/*', i)) { depth += 1; i += 2; }
        else if (sql.startsWith('*/', i)) { depth -= 1; i += 2; }
        else i += 1;
      }
      if (depth) throw new Error('Unterminated SQL comment');
    } else if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length);
      if (end < 0) throw new Error('Unterminated SQL dollar quote');
      i = end + dollar.length;
    } else {
      const escaped = quote === "'" && i > 0 && /[eE]/.test(sql[i - 1])
        && (i < 2 || !/[A-Za-z_0-9]/.test(sql[i - 2]));
      i += 1;
      let closed = false;
      while (i < sql.length) {
        if (escaped && sql[i] === '\\') { i += 2; continue; }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { i += 2; continue; }
          i += 1;
          closed = true;
          break;
        }
        i += 1;
      }
      if (!closed) throw new Error('Unterminated SQL quote');
    }
    segments.push({ text: sql.slice(literalStart, i), code: false });
    start = i;
  }
  if (start < sql.length) segments.push({ text: sql.slice(start), code: true });
  return segments;
}

export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  for (const segment of sqlSegments(sql)) {
    if (!segment.code) { current += segment.text; continue; }
    const parts = segment.text.split(';');
    current += parts[0];
    for (const part of parts.slice(1)) {
      if (sqlSegments(current).some((s) => s.code && s.text.trim())) statements.push(current.trim());
      current = part;
    }
  }
  if (sqlSegments(current).some((s) => s.code && s.text.trim())) statements.push(current.trim());
  return statements;
}

export function namedParameters(sql: string, count: number): { sql: string; used: number[] } {
  const used = new Set<number>();
  const mapped = sqlSegments(sql).map((segment) => segment.code
    ? segment.text.replace(/(?<![A-Za-z_0-9$])\$(\d+)\b/g, (_, position: string) => {
      const index = Number(position) - 1;
      if (index < 0 || index >= count) throw new Error('SQL parameter position is out of range');
      used.add(index);
      return `:p${index + 1}`;
    })
    : segment.text).join('');
  return { sql: mapped, used: [...used] };
}
