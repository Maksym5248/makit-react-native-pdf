export interface IPdfSearchRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface IPdfSearchMatch {
    page: number;
    start: number;
    length: number;
    text: string;
    rects: IPdfSearchRect[];
}
export interface IPdfSearchPage {
    matches: IPdfSearchMatch[];
    hasText: boolean;
    truncated: boolean;
}
/** Crop-box dimensions in PDF points, before intrinsic rotation. No OCR is performed. */
export interface IPdfPageInfo {
    width: number;
    height: number;
    rotation: number;
    hasText: boolean;
}
export interface IPdfThumbnail {
    uri: string;
    width: number;
    height: number;
}
export interface IPdfSearchDocument {
    pages: number;
    /** Extract the text layer of one page; empty for scans, without OCR. */
    getPageText(page: number): Promise<string>;
    getPageInfo(page: number): Promise<IPdfPageInfo>;
    /** Rasterize one page, with its longest edge capped at 512 pixels. */
    renderThumbnail(page: number, maxSize?: number): Promise<IPdfThumbnail>;
    searchPage(page: number, query: string, caseSensitive?: boolean): Promise<IPdfSearchPage>;
    close: () => void;
}
