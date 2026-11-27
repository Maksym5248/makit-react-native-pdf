import type { IPdfSearchDocument, IPdfThumbnail } from '../search.types';

/** One raster operation at a time; queued pages always follow the latest viewport. */
export class ThumbnailLoader {
    private wanted: number[] = [];
    private cache = new Map<number, IPdfThumbnail>();
    private failed = new Set<number>();
    private running = false;
    private disposed = false;

    constructor(
        private document: IPdfSearchDocument,
        private onChange: (images: ReadonlyMap<number, IPdfThumbnail>) => void,
        private onError: (error: Error) => void,
    ) {}

    setPages = (pages: number[]) => {
        if (this.disposed) return;
        this.wanted = [...new Set(pages)].filter(page => page >= 1 && page <= this.document.pages);
        for (const page of this.failed) if (!this.wanted.includes(page)) this.failed.delete(page);
        for (const page of this.cache.keys()) if (!this.wanted.includes(page)) this.cache.delete(page);
        this.publish();
        void this.pump();
    };

    dispose = () => {
        this.disposed = true;
        this.wanted = [];
        this.cache.clear();
        this.failed.clear();
    };

    private publish = () => this.onChange(new Map(this.cache));

    private pump = async () => {
        if (this.running || this.disposed) return;
        this.running = true;
        try {
            while (!this.disposed) {
                const page = this.wanted.find(value => !this.cache.has(value) && !this.failed.has(value));
                if (page === undefined) break;
                try {
                    const thumbnail = await this.document.renderThumbnail(page, 160);
                    if (this.disposed) break;
                    if (!this.wanted.includes(page)) continue;
                    this.cache.set(page, thumbnail);
                    // Strings use up to two bytes per character; cap encoded data while the viewport bounds the entry count.
                    let bytes = [...this.cache.values()].reduce((sum, image) => sum + image.uri.length * 2, 0);
                    for (const [cachedPage, image] of this.cache) {
                        if (bytes <= 2 * 1024 * 1024) break;
                        this.cache.delete(cachedPage);
                        this.failed.add(cachedPage);
                        bytes -= image.uri.length * 2;
                    }
                    this.publish();
                } catch (error) {
                    if (this.disposed) break;
                    this.failed.add(page);
                    this.onError(error instanceof Error ? error : new Error('Cannot render thumbnail'));
                }
            }
        } finally {
            this.running = false;
        }
    };
}
