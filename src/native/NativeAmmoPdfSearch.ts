import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type SearchRect = { x: number; y: number; width: number; height: number };
export type SearchMatch = { page: number; start: number; length: number; text: string; rects: SearchRect[] };
export type SearchPage = { matches: SearchMatch[]; hasText: boolean; truncated: boolean };
export interface Spec extends TurboModule {
    open(path: string, password: string): Promise<{ handle: number; pages: number }>;
    searchPage(handle: number, page: number, query: string, caseSensitive: boolean): Promise<SearchPage>;
    getPageText(handle: number, page: number): Promise<string>;
    getPageInfo(handle: number, page: number): Promise<{ width: number; height: number; rotation: number; hasText: boolean }>;
    renderThumbnail(handle: number, page: number, maxSize: number): Promise<{ uri: string; width: number; height: number }>;
    close(handle: number): void;
}
export default TurboModuleRegistry.getEnforcing<Spec>('AmmoPdfSearch');
