import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { PDFPageProxy } from 'pdfjs-dist';
import { Page } from 'react-pdf';

import { highlightText } from './highlight';
import type { IPdfSearchMatch } from './search.types';
import { usePageTap } from './use-page-tap.web';
import 'react-pdf/dist/Page/TextLayer.css';

interface Props {
    page: number;
    width: number;
    rotation: number;
    annotations: boolean;
    matches: IPdfSearchMatch[];
    active?: IPdfSearchMatch;
    onError: (error: Error) => void;
    onRender?: () => void;
    onActiveMatch: (element: HTMLElement) => void;
    onTap: (x: number, y: number) => void;
    onSize: (width: number, height: number) => void;
}
export function PdfPage({ page, width, rotation, annotations, matches, active, onError, onSize, onTap, onActiveMatch, onRender }: Props) {
    const element = useRef<HTMLDivElement>(null);
    const tapHandlers = usePageTap(onTap);
    const revealed = useRef<{ match: IPdfSearchMatch; width: number; rotation: number; reveal: Props['onActiveMatch'] } | undefined>(
        undefined,
    );
    const revealMatch = useCallback(() => {
        if (!active || active.page !== page) {
            revealed.current = undefined;
            return;
        }
        if (
            revealed.current?.match === active &&
            revealed.current.width === width &&
            revealed.current.rotation === rotation &&
            revealed.current.reveal === onActiveMatch
        )
            return;
        const match = element.current?.querySelector<HTMLElement>('mark[data-active-match]');
        if (match?.getAttribute('data-active-match') !== String(active.start)) return;
        revealed.current = { match: active, width, rotation, reveal: onActiveMatch };
        onActiveMatch(match);
    }, [active, page, width, rotation, onActiveMatch]);
    useEffect(() => {
        if (active?.page === page) revealMatch();
    }, [active, page, width, revealMatch]);
    const [loaded, setLoaded] = useState<PDFPageProxy>();
    const intrinsicRotation = loaded?.rotate ?? 0;
    useEffect(() => {
        if (!loaded) return;
        const viewport = loaded.getViewport({ scale: 1, rotation: (loaded.rotate + rotation) % 360 });
        onSize(viewport.width, viewport.height);
    }, [loaded, rotation, onSize]);
    const [offsets, setOffsets] = useState<number[]>([]);
    return (
        <Page
            inputRef={element}
            onRenderTextLayerSuccess={revealMatch}
            pageNumber={page}
            width={width}
            rotate={(intrinsicRotation + rotation) % 360}
            renderTextLayer
            renderAnnotationLayer={annotations}
            onRenderError={onError}
            onRenderSuccess={onRender}
            loading={null}
            {...tapHandlers}
            onLoadSuccess={setLoaded}
            onGetTextSuccess={content => {
                let offset = 0;
                setOffsets(
                    content.items.map(item => {
                        const start = offset;
                        if ('str' in item) offset += item.str.length + (item.hasEOL ? 1 : 0);
                        return start;
                    }),
                );
            }}
            customTextRenderer={({ str, itemIndex }) => highlightText(str, offsets[itemIndex] ?? 0, matches, active)}
        />
    );
}
