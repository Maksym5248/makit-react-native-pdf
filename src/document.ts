import type { IPdfOutline } from './pdf-reader.types';

// A browser may read a user-owned Blob URL, never a remote PDF URL.
export const isLocalPdfUri = (uri: string, platform: 'native' | 'web'): boolean => {
    if (platform === 'web') {
        return /^blob:(https?:\/\/|null\/).+/.test(uri);
    }

    return /^\/(?!\/).+/.test(uri) || /^file:\/\/\/.+/.test(uri) || /^content:\/\/[^/]+\/.+/.test(uri);
};

export const getNativePdfPath = (uri: string): string => {
    if (uri.startsWith('file://')) {
        return decodeURIComponent(uri.slice('file://'.length));
    }
    return uri;
};

export const clampPage = (page: number, total = 0): number => {
    const resolved = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    return total > 0 ? Math.min(resolved, total) : resolved;
};

export const clampScale = (scale: number, minScale = 0.6, maxScale = 3): number => {
    const minimum = Number.isFinite(minScale) && minScale > 0 ? minScale : 0.6;
    const maximum = Number.isFinite(maxScale) && maxScale >= minimum ? maxScale : Math.max(minimum, 3);
    return Math.min(maximum, Math.max(minimum, Number.isFinite(scale) ? scale : 1));
};

export type PdfEvent =
    | { type: 'load'; total: number; width: number; height: number; outline?: IPdfOutline[] }
    | { type: 'page'; page: number; total: number }
    | { type: 'error'; error: Error };

export const parsePdfEvent = (message: string): PdfEvent | undefined => {
    const [type, first, second, third] = message.split('|');
    if (type === 'error') {
        return { type: 'error', error: new Error(message.slice('error|'.length)) };
    }
    const total = Number(first);
    if (type === 'loadComplete' && Number.isInteger(total) && total > 0 && Number(second) > 0 && Number(third) > 0) {
        return {
            type: 'load',
            total,
            width: Number(second),
            height: Number(third),
            outline: parseOutline(message.split('|').slice(4).join('|')),
        };
    }
    if (type === 'pageChanged' && Number.isInteger(total) && total > 0 && Number.isInteger(Number(second)) && Number(second) >= total) {
        return { type: 'page', page: total, total: Number(second) };
    }
    return undefined;
};

const parseOutline = (json: string): IPdfOutline[] | undefined => {
    if (!json) return undefined;
    const mapItems = (items: unknown, depth: number): IPdfOutline[] => {
        if (!Array.isArray(items) || depth > 64) return [];
        return items.flatMap((item: unknown) => {
            if (!item || typeof item !== 'object' || !('title' in item) || typeof item.title !== 'string' || !('pageIdx' in item))
                return [];
            const pageIdx = Number(item.pageIdx);
            if (!Number.isInteger(pageIdx) || pageIdx < 0) return [];
            return [{ title: item.title, pageIdx, children: mapItems('children' in item ? item.children : [], depth + 1) }];
        });
    };
    try {
        const data: unknown = JSON.parse(json);
        return mapItems(data, 0);
    } catch {
        return undefined;
    }
};
