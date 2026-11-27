import type { IPdfSearchMatch, IPdfSearchPage } from './search.types';

export const searchText = (text: string, page: number, query: string, caseSensitive: boolean): IPdfSearchPage => {
    const matches: IPdfSearchMatch[] = [];
    if (!query.trim()) return { matches, hasText: text.length > 0, truncated: false };
    // Whitespace may be represented by a newline in a PDF text layer.
    const escaped = query
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
    const expression = new RegExp(escaped, caseSensitive ? 'gu' : 'giu');
    let truncated = false;
    for (const match of text.matchAll(expression)) {
        if (match.index === undefined) continue;
        if (matches.length === 256) {
            truncated = true;
            break;
        }
        matches.push({
            page,
            start: match.index,
            length: match[0].length,
            text: text.slice(Math.max(0, match.index - 40), match.index + match[0].length + 40),
            rects: [],
        });
    }
    return { matches, hasText: text.length > 0, truncated };
};
