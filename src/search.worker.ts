import { searchText } from './search-text';

self.onmessage = (event: MessageEvent<{ id: number; text: string; page: number; query: string; caseSensitive: boolean }>) => {
    const { id, text, page, query, caseSensitive } = event.data;
    self.postMessage({ id, result: searchText(text, page, query, caseSensitive) });
};
