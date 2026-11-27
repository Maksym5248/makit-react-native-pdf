import type { IPdfSearchMatch } from './search.types';

const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export const highlightText = (text: string, offset: number, matches: IPdfSearchMatch[], active?: IPdfSearchMatch): string => {
    let cursor = 0;
    let html = '';
    for (const match of matches) {
        const start = Math.max(cursor, match.start - offset);
        const end = Math.min(text.length, match.start + match.length - offset);
        if (start >= end) continue;
        html += escape(text.slice(cursor, start));
        const color = match === active ? 'rgba(255,128,0,.6)' : 'rgba(255,230,0,.4)';
        html += `<mark${match === active ? ` data-active-match="${match.start}"` : ''} style="color:transparent;background:${color}">${escape(text.slice(start, end))}</mark>`;
        cursor = end;
    }
    return html + escape(text.slice(cursor));
};
