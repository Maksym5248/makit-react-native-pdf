import type { PDFDocumentProxy, PDFPageProxy, PDFWorker } from 'pdfjs-dist';
import { pdfjs } from 'react-pdf';

import { isLocalPdfUri } from './document';
import type { IPdfSearchDocument, IPdfSearchPage } from './search.types';

const workerSource = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
export const openPdfSearch = async (uri: string, password = ''): Promise<IPdfSearchDocument> => {
    if (!isLocalPdfUri(uri, 'web')) throw new Error('A local Blob URL is required');
    const port = new Worker(workerSource, { type: 'module' });
    const fromPort: (params: { port: Worker }) => PDFWorker = pdfjs.PDFWorker.fromPort.bind(pdfjs.PDFWorker);
    const worker = fromPort({ port });
    const task = pdfjs.getDocument({ url: uri, password, worker });
    let document: PDFDocumentProxy;
    try {
        document = await task.promise;
    } catch (error) {
        worker.destroy();
        port.terminate();
        throw error;
    }
    let matcher: Worker;
    try {
        matcher = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
        await task.destroy();
        worker.destroy();
        port.terminate();
        throw error;
    }
    let nextRequest = 1;
    const pending = new Map<number, { resolve: (result: IPdfSearchPage) => void; reject: (error: Error) => void }>();
    matcher.onmessage = (event: MessageEvent<{ id: number; result: IPdfSearchPage }>) => {
        pending.get(event.data.id)?.resolve(event.data.result);
        pending.delete(event.data.id);
    };
    let workerFailed = false;
    matcher.onerror = () => {
        workerFailed = true;
        pending.forEach(request => request.reject(new Error('PDF search worker failed')));
        pending.clear();
    };
    let closed = false;
    // PDF.js caches page proxies. Serialize operations so cleanup never races a render.
    let queue = Promise.resolve();
    const withPage = <T>(pageNumber: number, operation: (page: PDFPageProxy) => Promise<T>): Promise<T> => {
        const result = queue.then(async () => {
            if (closed) throw new Error('PDF search document is closed');
            if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > document.numPages) throw new Error('Invalid PDF page');
            const page = await document.getPage(pageNumber);
            try {
                const value = await operation(page);
                if (closed) throw new Error('PDF search document is closed');
                return value;
            } finally {
                page.cleanup();
            }
        });
        queue = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    };
    return {
        pages: document.numPages,
        getPageText: pageNumber =>
            withPage(pageNumber, async page => {
                const content = await page.getTextContent();
                return content.items.map(item => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join('');
            }),
        getPageInfo: pageNumber =>
            withPage(pageNumber, async page => {
                const content = await page.getTextContent();
                return {
                    width: page.view[2] - page.view[0],
                    height: page.view[3] - page.view[1],
                    rotation: page.rotate,
                    hasText: content.items.some(item => 'str' in item && item.str.length > 0),
                };
            }),
        renderThumbnail: (pageNumber, maxSize = 160) =>
            withPage(pageNumber, async page => {
                if (!Number.isFinite(maxSize) || maxSize < 1) throw new Error('Invalid thumbnail size');
                const natural = page.getViewport({ scale: 1 });
                const viewport = page.getViewport({ scale: Math.min(512, Math.ceil(maxSize)) / Math.max(natural.width, natural.height) });
                const canvas = globalThis.document.createElement('canvas');
                canvas.width = Math.max(1, Math.floor(viewport.width));
                canvas.height = Math.max(1, Math.floor(viewport.height));
                try {
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('Cannot create thumbnail canvas');
                    await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
                    return { uri: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
                } finally {
                    canvas.width = 0;
                    canvas.height = 0;
                }
            }),
        searchPage: async (pageNumber, query, caseSensitive = false) => {
            if (closed) throw new Error('PDF search document is closed');
            if (workerFailed) throw new Error('PDF search worker failed');
            if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > document.numPages) throw new Error('Invalid PDF page');
            if (!query.trim()) return { matches: [], hasText: false, truncated: false };
            if (query.length > 512) throw new Error('Search query is limited to 512 characters');
            return withPage(pageNumber, async page => {
                const content = await page.getTextContent();
                if (closed) throw new Error('PDF search document is closed');
                if (workerFailed) throw new Error('PDF search worker failed');
                const text = content.items.map(item => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join('');
                return await new Promise<IPdfSearchPage>((resolve, reject) => {
                    const id = nextRequest++;
                    pending.set(id, { resolve, reject });
                    matcher.postMessage({ id, text, page: pageNumber, query, caseSensitive });
                });
            });
        },
        close: () => {
            if (closed) return;
            closed = true;
            matcher.terminate();
            pending.forEach(request => request.reject(new Error('PDF search document is closed')));
            pending.clear();
            void task.destroy().finally(() => {
                worker.destroy();
                port.terminate();
            });
        },
    };
};
