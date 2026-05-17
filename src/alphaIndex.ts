import { pinyin } from 'pinyin-pro';
import { AlphaSection } from './types';

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

const CJK_RE = /[\u3400-\u9fff]/;
const LETTER_RE = /^[a-z]$/i;

export interface AlphaIndexedList<T> {
  items: T[];
  sections: AlphaSection[];
}

export const alphaKeyForLabel = (label: string) => {
  const trimmed = label.trim();
  if (!trimmed) return '#';

  const first = [...trimmed][0];
  if (LETTER_RE.test(first)) return first.toUpperCase();

  if (CJK_RE.test(first)) {
    const initials = pinyin(first, {
      pattern: 'first',
      toneType: 'none',
      type: 'array',
    }) as string[];
    const initial = initials[0]?.[0];
    return initial && LETTER_RE.test(initial) ? initial.toUpperCase() : '#';
  }

  return '#';
};

const sectionOrder = (key: string) => (key === '#' ? 26 : key.charCodeAt(0) - 65);

export const buildAlphaIndexedList = <T,>(
  items: T[],
  getLabel: (item: T) => string,
): AlphaIndexedList<T> => {
  const sorted = [...items].sort((left, right) => {
    const leftKey = alphaKeyForLabel(getLabel(left));
    const rightKey = alphaKeyForLabel(getLabel(right));
    const keySort = sectionOrder(leftKey) - sectionOrder(rightKey);
    if (keySort) return keySort;
    return collator.compare(getLabel(left), getLabel(right));
  });

  const sections: AlphaSection[] = [];
  sorted.forEach((item, index) => {
    const key = alphaKeyForLabel(getLabel(item));
    const current = sections[sections.length - 1];
    if (current?.key === key) {
      current.count += 1;
      return;
    }
    sections.push({ key, startIndex: index, count: 1 });
  });

  return { items: sorted, sections };
};

export const findAlphaSectionForIndex = (sections: AlphaSection[] | undefined, index: number) => {
  if (!sections?.length) return undefined;
  let active = sections[0];
  for (const section of sections) {
    if (section.startIndex > index) break;
    active = section;
  }
  return active;
};
