import React, { forwardRef, useMemo, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import { clampPage, clampScale, getNativePdfPath, isLocalPdfUri, parsePdfEvent } from './document';
import NativePdf, { Commands } from './native/AmmoPDFPdfNativeComponent';
import { PdfLoading } from './pdf-loading';
import type { IPdfReaderProps, IPdfReaderRef } from './pdf-reader.types';

const NativeDocument = forwardRef<IPdfReaderRef, IPdfReaderProps>((props, ref) => {
    const highlights = useMemo(
        () =>
            JSON.stringify({
                matches: (props.highlights ?? []).slice(0, 256),
                active: props.activeMatch ?? -1,
                insets: props.highlightContentInsets,
            }),
        [props.highlights, props.activeMatch, props.highlightContentInsets],
    );
    const nativeRef = useRef<React.ElementRef<typeof NativePdf>>(null);
    const active = useRef(true);
    const [loading, setLoading] = useState(true);
    const total = useRef(0);
    const pendingPage = useRef<number | undefined>(undefined);
    let path = '';
    try {
        path = isLocalPdfUri(props.sourceUri, 'native') ? getNativePdfPath(props.sourceUri) : '';
    } catch {
        // Malformed percent encoding is an invalid file URI, not a native crash.
    }
    const errorCallback = useRef(props.onError);
    errorCallback.current = props.onError;

    useEffect(() => {
        active.current = true;
        if (!path) errorCallback.current?.(new Error('A local PDF file URI is required'));
        return () => {
            active.current = false;
        };
    }, [path]);

    useImperativeHandle(
        ref,
        () => ({
            setPage: page => {
                const next = clampPage(page, total.current);
                if (total.current && nativeRef.current) {
                    Commands.setNativePage(nativeRef.current, next);
                } else {
                    pendingPage.current = next;
                }
            },
        }),
        [],
    );

    if (!path) return <View style={props.style} />;

    return (
        <View style={[styles.document, props.style]}>
            <NativePdf
                ref={nativeRef}
                style={styles.document}
                path={path}
                highlights={highlights}
                page={clampPage(props.page ?? 1)}
                scale={clampScale(props.scale ?? 1, props.minScale, props.maxScale)}
                minScale={props.minScale ?? 0.6}
                maxScale={props.maxScale ?? 3}
                rotation={props.rotation ?? 0}
                horizontal={props.horizontal ?? false}
                enablePaging={props.enablePaging ?? false}
                enableRTL={props.enableRTL ?? false}
                enableAnnotationRendering={props.enableAnnotationRendering ?? true}
                showsHorizontalScrollIndicator={props.showsHorizontalScrollIndicator ?? false}
                showsVerticalScrollIndicator={props.showsVerticalScrollIndicator ?? false}
                scrollEnabled={props.scrollEnabled ?? true}
                enableAntialiasing={props.enableAntialiasing ?? true}
                enableDoubleTapZoom={props.enableDoubleTapZoom ?? !props.singlePage}
                fitPolicy={props.fitPolicy ?? 0}
                spacing={props.spacing ?? 10}
                password={props.password ?? ''}
                singlePage={props.singlePage ?? false}
                onChange={event => {
                    if (!active.current) return;
                    const [kind, first, second, third] = event.nativeEvent.message.split('|');
                    if (kind === 'renderReady') setLoading(false);
                    if (kind === 'scaleChanged' && Number.isFinite(Number(first))) props.onScaleChanged?.(Number(first));
                    if (kind === 'pageSingleTap') props.onPageSingleTap?.(Number(first), Number(second), Number(third));
                    if (kind === 'linkPressed') props.onPressLink?.(event.nativeEvent.message.slice('linkPressed|'.length));
                    const parsed = parsePdfEvent(event.nativeEvent.message);
                    if (parsed?.type === 'load') {
                        // PDFKit reports document readiness here; Android renders asynchronously.
                        if (Platform.OS === 'ios') setLoading(false);
                        total.current = parsed.total;
                        const size = { width: parsed.width, height: parsed.height };
                        if (parsed.outline) props.onLoadComplete?.(parsed.total, props.sourceUri, size, parsed.outline);
                        else props.onLoadComplete?.(parsed.total, props.sourceUri, size);
                        if (pendingPage.current !== undefined && nativeRef.current) {
                            Commands.setNativePage(nativeRef.current, clampPage(pendingPage.current, parsed.total));
                            pendingPage.current = undefined;
                        }
                    } else if (parsed?.type === 'page') {
                        props.onPageChanged?.(parsed.page, parsed.total);
                    } else if (parsed?.type === 'error') {
                        setLoading(false);
                        props.onError?.(parsed.error);
                    }
                }}
            />
            {loading && <PdfLoading renderLoading={props.renderLoading} />}
        </View>
    );
});
NativeDocument.displayName = 'NativePdfDocument';

export const PdfReader = forwardRef<IPdfReaderRef, IPdfReaderProps>((props, ref) => (
    <NativeDocument key={JSON.stringify([props.sourceUri, props.password])} {...props} ref={ref} />
));
PdfReader.displayName = 'PdfReader';

const styles = StyleSheet.create({
    document: { flex: 1, overflow: 'hidden', backgroundColor: '#eee' },
});
