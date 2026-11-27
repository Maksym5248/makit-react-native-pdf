import type { ReactNode } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

import type { IPdfSearchMatch } from './search.types';

export interface IPdfOutline {
    title: string;
    pageIdx: number;
    children: IPdfOutline[];
}

export interface IPdfReaderRef {
    setPage(page: number): void;
}

export interface IPdfReaderProps {
    sourceUri: string;
    /** Local document preparation, not network download progress. */
    renderLoading?: () => ReactNode;
    highlights?: IPdfSearchMatch[];
    activeMatch?: number;
    /** Visible viewport insets (logical pixels) used only when revealing an active highlight.
     * Does not add document padding; navigation is clamped at document boundaries. */
    highlightContentInsets?: { top?: number; bottom?: number; left?: number; right?: number };
    page?: number;
    scale?: number;
    minScale?: number;
    maxScale?: number;
    rotation?: 0 | 90 | 180 | 270;
    horizontal?: boolean;
    enablePaging?: boolean;
    enableRTL?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    showsVerticalScrollIndicator?: boolean;
    enableAntialiasing?: boolean;
    enableDoubleTapZoom?: boolean;
    fitPolicy?: 0 | 1 | 2;
    spacing?: number;
    password?: string;
    onScaleChanged?: (scale: number) => void;
    onPageSingleTap?: (page: number, x: number, y: number) => void;
    onPressLink?: (url: string) => void;
    scrollEnabled?: boolean;
    singlePage?: boolean;
    enableAnnotationRendering?: boolean;
    style?: StyleProp<ViewStyle>;
    onPageChanged?: (page: number, total: number) => void;
    onLoadComplete?: (total: number, filePath?: string, size?: { width: number; height: number }, outline?: IPdfOutline[]) => void;
    onError?: (error: Error) => void;
}
