'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { PDFDocumentProxy, PDFWorker } from 'pdfjs-dist';
import { StyleSheet, View } from 'react-native';
import { Document, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';

import { clampPage, clampScale, isLocalPdfUri } from './document';
import { PdfLoading } from './pdf-loading';
import { PdfPage } from './pdf-page.web';
import type { IPdfOutline, IPdfReaderProps, IPdfReaderRef } from './pdf-reader.types';
import type { IPdfSearchMatch } from './search.types';

// Bundled by the consuming application: no CDN request while reading offline.
const workerSource = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
const options = {
    verbosity: pdfjs.VerbosityLevel.ERRORS,
};

type OutlineItem = NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>[number];
async function readOutline(pdf: PDFDocumentProxy, items: OutlineItem[]): Promise<IPdfOutline[]> {
    return Promise.all(
        items.map(async item => {
            const destination = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
            let pageIdx = -1;
            if (Array.isArray(destination) && destination.length) {
                const target = destination[0];
                pageIdx = typeof target === 'number' ? target : await pdf.getPageIndex(target);
            }
            return { title: item.title, pageIdx, children: await readOutline(pdf, item.items) };
        }),
    );
}

const WebDocument = forwardRef<IPdfReaderRef, IPdfReaderProps>((props, ref) => {
    const container = useRef<HTMLDivElement>(null);
    const pages = useRef(new Map<number, HTMLDivElement>());
    const active = useRef(true);
    const [loading, setLoading] = useState(true);
    const onError = useCallback((error: Error) => {
        if (!active.current) return;
        setLoading(false);
        callbacks.current.onError?.(error);
    }, []);
    const requestedPage = useRef(clampPage(props.page ?? 1));
    const previousPageProp = useRef(props.page);
    const ignoredActiveMatch = useRef<IPdfSearchMatch | undefined>(undefined);
    const [worker, setWorker] = useState<PDFWorker>();
    const documentOptions = useMemo(() => ({ ...options, worker, password: props.password }), [worker, props.password]);
    const [document, setDocument] = useState<PDFDocumentProxy>();
    const [size, setSize] = useState({ width: 0, height: 0 });
    const width = size.width;
    const [pageRatios, setPageRatios] = useState(new Map<number, number>());
    const [current, setCurrent] = useState(requestedPage.current);
    const [visiblePages, setVisiblePages] = useState(new Set([requestedPage.current]));
    const [aspectRatio, setAspectRatio] = useState(1.414);
    const total = document?.numPages ?? 0;
    const single = props.singlePage ?? false;
    const [requestedScale, setRequestedScale] = useState(props.scale ?? 1);
    const scale = clampScale(requestedScale, props.minScale, props.maxScale);
    useEffect(() => setRequestedScale(props.scale ?? 1), [props.scale]);
    useEffect(() => {
        callbacks.current.onScaleChanged?.(scale);
    }, [scale]);
    const horizontal = props.horizontal ?? false;
    const pageWidthFor = (page: number) => {
        const ratio = pageRatios.get(page) ?? aspectRatio;
        const heightFit = size.height / ratio;
        let fit = width;
        if (props.fitPolicy === 1) fit = heightFit;
        if (props.fitPolicy === 2) fit = Math.min(width, heightFit);
        return Math.max(1, Math.floor(fit * scale));
    };
    const callbacks = useRef(props);
    callbacks.current = props;
    const valid = isLocalPdfUri(props.sourceUri, 'web');

    useEffect(() => {
        active.current = true;
        if (!valid) onError(new Error('A local Blob URL is required'));
        return () => {
            active.current = false;
        };
    }, [onError, valid]);

    useEffect(() => {
        if (!valid) return;
        // Own the worker per document: the legacy reader can configure PDF.js globally.
        let port: Worker;
        try {
            port = new Worker(workerSource, { type: 'module' });
        } catch (error) {
            onError(error instanceof Error ? error : new Error('Cannot start the local PDF worker'));
            return;
        }
        // PDF.js 4.8 declares the factory return as any; keep that at the SDK boundary.
        const fromPort: (params: { port: Worker }) => PDFWorker = pdfjs.PDFWorker.fromPort.bind(pdfjs.PDFWorker);
        const documentWorker = fromPort({ port });
        port.onerror = () => onError(new Error('Cannot start the local PDF worker'));
        setWorker(documentWorker);
        return () => {
            port.onerror = null;
            documentWorker.destroy();
            port.terminate();
        };
    }, [onError, valid]);

    const jump = useCallback(
        (page: number) => {
            const next = clampPage(page, total);
            const selectedMatch = callbacks.current.highlights?.[callbacks.current.activeMatch ?? -1];
            ignoredActiveMatch.current = selectedMatch && selectedMatch.page !== next ? selectedMatch : undefined;
            requestedPage.current = next;
            setCurrent(next);
            setVisiblePages(new Set([next - 1, next, next + 1]));
            const element = pages.current.get(next);
            if (element && container.current && !single) {
                if (horizontal) container.current.scrollLeft = element.offsetLeft;
                else container.current.scrollTop = element.offsetTop;
            }
        },
        [single, total, horizontal],
    );

    useImperativeHandle(ref, () => ({ setPage: jump }), [jump]);
    useEffect(() => {
        if (previousPageProp.current !== props.page) {
            previousPageProp.current = props.page;
            jump(props.page ?? 1);
        }
    }, [props.page, jump]);
    useEffect(() => {
        if (total > 0) callbacks.current.onPageChanged?.(current, total);
    }, [current, total]);

    useEffect(() => {
        const element = container.current;
        if (!element) return;
        const resize = () => setSize({ width: element.clientWidth, height: element.clientHeight });
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!container.current || single || !total) return;
        // Compare visible area: a tiny fully visible page must not outweigh a larger page.
        const visibility = new Map<number, number>();
        const observer = new IntersectionObserver(
            entries => {
                for (const entry of entries) {
                    const page = Number(entry.target.getAttribute('data-page-number'));
                    if (entry.isIntersecting) visibility.set(page, entry.intersectionRect.width * entry.intersectionRect.height);
                    else visibility.delete(page);
                }
                const visible = [...visibility.keys()];
                if (!visible.length) return;
                const best = [...visibility].sort((a, b) => b[1] - a[1])[0];
                if (best) {
                    requestedPage.current = best[0];
                    setCurrent(best[0]);
                }
                // Render visible pages and one neighbour, while keeping all page slots for navigation.
                setVisiblePages(new Set(visible.flatMap(page => [page - 1, page, page + 1])));
            },
            { root: container.current, threshold: [0, 0.25, 0.5, 0.75, 1] },
        );
        pages.current.forEach(element => observer.observe(element));
        jump(requestedPage.current);
        return () => observer.disconnect();
    }, [jump, single, total]);

    useEffect(() => {
        setPageRatios(new Map());
    }, [props.rotation]);

    useEffect(() => {
        if (total) jump(requestedPage.current);
    }, [props.rotation, props.fitPolicy, props.enablePaging, props.enableRTL, jump, total]);

    const onLoad = async (pdf: PDFDocumentProxy) => {
        try {
            const page = await pdf.getPage(clampPage(requestedPage.current, pdf.numPages));
            if (!active.current) return;
            const viewport = page.getViewport({ scale: 1, rotation: (page.rotate + (props.rotation ?? 0)) % 360 });
            setAspectRatio(viewport.height / viewport.width);
            setCurrent(clampPage(requestedPage.current, pdf.numPages));
            setDocument(pdf);
            const outline = await readOutline(pdf, (await pdf.getOutline()) ?? []);
            if (!active.current) return;
            callbacks.current.onLoadComplete?.(
                pdf.numPages,
                props.sourceUri,
                {
                    width: viewport.width,
                    height: viewport.height,
                },
                outline,
            );
        } catch (error) {
            onError(error instanceof Error ? error : new Error('Cannot open PDF'));
        }
    };

    const insetTop = Math.max(0, props.highlightContentInsets?.top ?? 0);
    const insetBottom = Math.max(0, props.highlightContentInsets?.bottom ?? 0);
    const insetLeft = Math.max(0, props.highlightContentInsets?.left ?? 0);
    const insetRight = Math.max(0, props.highlightContentInsets?.right ?? 0);
    const revealMatch = useCallback(
        (element: HTMLElement) => {
            const selectedMatch = callbacks.current.highlights?.[callbacks.current.activeMatch ?? -1];
            // A late text-layer render must not undo a page command issued after it started.
            if (selectedMatch && selectedMatch === ignoredActiveMatch.current) return;
            const viewport = container.current;
            if (!viewport) return;
            const bounds = viewport.getBoundingClientRect();
            const match = element.getBoundingClientRect();
            // Scroll only: the browser clamps at the first/last page without adding padding.
            viewport.scrollTop += match.top - bounds.top - Math.min(insetTop, Math.max(0, bounds.height - insetBottom - match.height));
            if (match.left < bounds.left + insetLeft || match.right > bounds.right - insetRight) {
                viewport.scrollLeft += match.left - bounds.left - insetLeft;
            }
        },
        [insetTop, insetBottom, insetLeft, insetRight],
    );

    const renderPage = (page: number) => (
        <PdfPage
            page={page}
            onActiveMatch={revealMatch}
            onRender={() => {
                if (active.current && page === requestedPage.current) setLoading(false);
            }}
            onTap={(x, y) => callbacks.current.onPageSingleTap?.(page, x, y)}
            width={pageWidthFor(page)}
            rotation={props.rotation ?? 0}
            annotations={props.enableAnnotationRendering ?? true}
            matches={(props.highlights ?? []).filter(match => match.page === page)}
            active={props.highlights?.[props.activeMatch ?? -1]}
            onError={error => {
                onError(error);
            }}
            onSize={(pageWidthPoints, pageHeightPoints) => {
                const ratio = pageHeightPoints / pageWidthPoints;
                setPageRatios(previous => (previous.get(page) === ratio ? previous : new Map(previous).set(page, ratio)));
            }}
        />
    );

    return (
        <View style={[styles.document, props.style]}>
            <div
                ref={container}
                onDoubleClick={event => {
                    if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select')) return;
                    if (props.enableDoubleTapZoom === false || single) return;
                    setRequestedScale(scale >= (props.maxScale ?? 3) ? 1 : scale * 1.5);
                }}
                onClickCapture={event => {
                    if (!(event.target instanceof Element)) return;
                    const link = event.target.closest('a[href]');
                    if (!link) return;
                    const url = link.getAttribute('href');
                    if (url && !url.startsWith('#')) {
                        event.preventDefault();
                        event.stopPropagation();
                        callbacks.current.onPressLink?.(url);
                    }
                }}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflowY: props.scrollEnabled === false ? 'hidden' : 'auto',
                    overflowX: props.scrollEnabled === false ? 'hidden' : 'auto',
                    scrollSnapType: props.enablePaging && !single ? `${horizontal ? 'x' : 'y'} mandatory` : undefined,
                    overscrollBehavior: 'contain',
                    direction: 'ltr',
                }}
            >
                {valid && worker && (
                    <Document
                        file={props.sourceUri}
                        options={documentOptions}
                        loading={null}
                        onPassword={() => onError(new Error('Password required or incorrect password.'))}
                        onLoadSuccess={onLoad}
                        onItemClick={({ pageNumber }) => jump(pageNumber)}
                        onLoadError={error => {
                            onError(error);
                        }}
                    >
                        <div style={{ display: horizontal && !single ? 'flex' : 'block', width: horizontal ? 'max-content' : undefined }}>
                            {width > 0 &&
                                total > 0 &&
                                (single
                                    ? renderPage(current)
                                    : Array.from({ length: total }, (_, index) => {
                                          const page = props.enableRTL ? total - index : index + 1;
                                          return (
                                              <div
                                                  key={page}
                                                  data-page-number={page}
                                                  ref={element => {
                                                      if (element) pages.current.set(page, element);
                                                      else pages.current.delete(page);
                                                  }}
                                                  style={{
                                                      flexShrink: 0,
                                                      minHeight: Math.max(
                                                          props.enablePaging ? size.height : 0,
                                                          pageWidthFor(page) * (pageRatios.get(page) ?? aspectRatio),
                                                      ),
                                                      width:
                                                          horizontal && props.enablePaging
                                                              ? Math.max(width, pageWidthFor(page))
                                                              : pageWidthFor(page),
                                                      marginBottom: horizontal ? 0 : (props.spacing ?? 10),
                                                      marginRight: horizontal ? (props.spacing ?? 10) : 0,
                                                      scrollSnapAlign: props.enablePaging ? 'start' : undefined,
                                                      scrollSnapStop: props.enablePaging ? 'always' : undefined,
                                                  }}
                                              >
                                                  {visiblePages.has(page) ? renderPage(page) : null}
                                              </div>
                                          );
                                      }))}
                        </div>
                    </Document>
                )}
            </div>
            {valid && loading && <PdfLoading renderLoading={props.renderLoading} />}
        </View>
    );
});
WebDocument.displayName = 'WebPdfDocument';

export const PdfReader = forwardRef<IPdfReaderRef, IPdfReaderProps>((props, ref) => (
    <WebDocument key={JSON.stringify([props.sourceUri, props.password])} {...props} ref={ref} />
));
PdfReader.displayName = 'PdfReader';
const styles = StyleSheet.create({
    document: { flex: 1, overflow: 'hidden', backgroundColor: '#eee' },
});
