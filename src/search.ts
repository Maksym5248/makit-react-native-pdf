import { getNativePdfPath, isLocalPdfUri } from './document';
import NativeSearch from './native/NativeAmmoPdfSearch';
import type { IPdfSearchDocument } from './search.types';

export const openPdfSearch = async (uri: string, password = ''): Promise<IPdfSearchDocument> => {
    if (!isLocalPdfUri(uri, 'native')) throw new Error('A local PDF URI is required');
    const document = await NativeSearch.open(getNativePdfPath(uri), password);
    let closed = false;
    const validatePage = (page: number) => {
        if (closed) throw new Error('PDF search document is closed');
        if (!Number.isInteger(page) || page < 1 || page > document.pages) throw new Error('Invalid PDF page');
    };
    return {
        pages: document.pages,
        getPageText: async page => {
            validatePage(page);
            const text = await NativeSearch.getPageText(document.handle, page);
            validatePage(page);
            return text;
        },
        getPageInfo: async page => {
            validatePage(page);
            const result = await NativeSearch.getPageInfo(document.handle, page);
            validatePage(page);
            return result;
        },
        renderThumbnail: async (page, maxSize = 160) => {
            validatePage(page);
            if (!Number.isFinite(maxSize) || maxSize < 1) throw new Error('Invalid thumbnail size');
            const result = await NativeSearch.renderThumbnail(document.handle, page, Math.min(512, Math.ceil(maxSize)));
            validatePage(page);
            return result;
        },
        searchPage: async (page, query, caseSensitive = false) => {
            if (closed) throw new Error('PDF search document is closed');
            if (!Number.isInteger(page) || page < 1 || page > document.pages) throw new Error('Invalid PDF page');
            if (!query.trim()) return { matches: [], hasText: false, truncated: false };
            if (query.length > 512) throw new Error('Search query is limited to 512 characters');
            const result = await NativeSearch.searchPage(document.handle, page, query, caseSensitive);
            if (closed) throw new Error('PDF search document is closed');
            return result;
        },
        close: () => {
            if (closed) return;
            closed = true;
            NativeSearch.close(document.handle);
        },
    };
};
