const DIGIT_WORDS: Record<string, string> = {
  khong: '0',
  mot: '1',
  hai: '2',
  ba: '3',
  bon: '4',
  tu: '4',
  nam: '5',
  lam: '5',
  sau: '6',
  bay: '7',
  tam: '8',
  chin: '9',
};

const SCALE_WORDS: Record<string, number> = {
  muoi: 10,
  tram: 100,
  nghin: 1000,
  ngan: 1000,
  trieu: 1000000,
  ty: 1000000000,
};

const ZERO_MARKERS = new Set(['linh', 'le']);

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const chunk of text.split(/([\s.,;!?…—-]+)/)) {
    const t = chunk.trim();
    if (!t) continue;
    if (/^[.,;!?…—-]+$/.test(t)) {
      tokens.push('|');
    } else {
      tokens.push(t);
    }
  }
  return tokens;
}

function isDigitWord(t: string): boolean {
  return t in DIGIT_WORDS;
}

function isScaleWord(t: string): boolean {
  return t in SCALE_WORDS;
}

function parseGroup(
  words: string[],
  i: number,
): { value: number; next: number } | null {
  if (i >= words.length) return null;
  const w = words[i];

  if (w === 'muoi') {
    let value = 10;
    let j = i + 1;
    if (isDigitWord(words[j]) && !isScaleWord(words[j])) {
      value += Number(DIGIT_WORDS[words[j]]);
      j++;
    }
    return { value, next: j };
  }

  if (isDigitWord(w)) {
    const d = Number(DIGIT_WORDS[w]);
    const next = words[i + 1];

    if (next === 'tram') {
      let value = d * 100;
      let j = i + 2;
      if (words[j] === 'muoi') {
        value += 10;
        j++;
        if (isDigitWord(words[j])) {
          value += Number(DIGIT_WORDS[words[j]]);
          j++;
        }
        return { value, next: j };
      }
      if (ZERO_MARKERS.has(words[j])) {
        j++;
        if (isDigitWord(words[j])) {
          value += Number(DIGIT_WORDS[words[j]]);
          j++;
        }
        return { value, next: j };
      }
      if (isDigitWord(words[j])) {
        const tens = Number(DIGIT_WORDS[words[j]]);
        j++;
        if (words[j] === 'muoi') {
          value += tens * 10;
          j++;
          if (isDigitWord(words[j])) {
            value += Number(DIGIT_WORDS[words[j]]);
            j++;
          }
          return { value, next: j };
        }
        if (isDigitWord(words[j])) {
          value += tens * 10 + Number(DIGIT_WORDS[words[j]]);
          j++;
          return { value, next: j };
        }
        value += tens * 10;
        return { value, next: j };
      }
      return { value, next: j };
    }

    if (next === 'muoi') {
      let value = d * 10;
      let j = i + 2;
      if (isDigitWord(words[j])) {
        value += Number(DIGIT_WORDS[words[j]]);
        j++;
      }
      return { value, next: j };
    }

    if (ZERO_MARKERS.has(next)) {
      let value = d * 100;
      let j = i + 2;
      if (isDigitWord(words[j])) {
        value += Number(DIGIT_WORDS[words[j]]);
        j++;
      }
      return { value, next: j };
    }

    return { value: d, next: i + 1 };
  }

  return null;
}

function parseFullNumber(words: string[]): number | null {
  if (words.length === 0) return null;
  const parts: { value: number; scale: number }[] = [];
  let i = 0;
  while (i < words.length) {
    const res = parseGroup(words, i);
    if (!res) return null;
    let scale = 0;
    let next = res.next;
    if (next < words.length && isScaleWord(words[next])) {
      scale = SCALE_WORDS[words[next]];
      next++;
    }
    parts.push({ value: res.value, scale });
    i = next;
    if (scale === 0) break;
  }
  if (i !== words.length) return null;

  let prev = Infinity;
  for (const p of parts) {
    if (p.scale >= prev) return null;
    prev = p.scale;
  }
  let total = 0;
  for (const p of parts) total += p.value * (p.scale === 0 ? 1 : p.scale);
  return total;
}

function toCandidateCodes(digitStr: string): string[] {
  const clean = digitStr.replace(/\D/g, '');
  if (!clean || clean.length < 7) return [];
  const out: string[] = [];
  if (clean.length === 7) {
    out.push(clean);
  } else if (clean.length % 7 === 0) {
    for (let i = 0; i < clean.length; i += 7) out.push(clean.slice(i, i + 7));
  } else {
    for (let i = 0; i + 7 <= clean.length; i++) out.push(clean.slice(i, i + 7));
  }
  return [...new Set(out)];
}

/**
 * Trích xuất các mã container (7 số cuối) từ văn bản tiếng Việt (bao gồm cả
 * kết quả voice-to-text có lẫn từ nhiễu như "ờ", "à", "ơ").
 *
 * Hỗ trợ cả đọc từng số ("sáu tám hai ba không hai ba") lẫn đọc số nguyên
 * ("sáu triệu tám trăm hai mươi ba nghìn...").
 */
export function extractContainerCodes(text: string): string[] {
  const tokens = tokenize(text);
  const buf: string[] = [];
  const numberStrings: string[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    const full = parseFullNumber(buf);
    if (full !== null) {
      numberStrings.push(String(full));
    } else {
      let s = '';
      for (const t of buf) {
        if (isDigitWord(t)) s += DIGIT_WORDS[t];
        else if (/^\d+$/.test(t)) s += t;
      }
      if (s) numberStrings.push(s);
    }
    buf.length = 0;
  };

  for (const raw of tokens) {
    if (raw === '|') {
      flush();
      continue;
    }
    const t = normalizeToken(raw);
    if (!t) continue;
    if (
      isDigitWord(t) ||
      isScaleWord(t) ||
      ZERO_MARKERS.has(t) ||
      /^\d+$/.test(t)
    ) {
      buf.push(t);
    }
  }
  flush();

  const candidates: string[] = [];
  for (const s of numberStrings) {
    candidates.push(...toCandidateCodes(s));
  }
  return [...new Set(candidates)];
}
