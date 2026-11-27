import { openPdfSearch } from '../src/search';
import { searchText } from '../src/search-text';
import { highlightText } from '../src/highlight';
import native from '../src/native/NativeAmmoPdfSearch';
jest.mock('../src/native/NativeAmmoPdfSearch', () => ({ __esModule: true, default: { open: jest.fn(), searchPage: jest.fn(), getPageText: jest.fn(), getPageInfo: jest.fn(), renderThumbnail: jest.fn(), close: jest.fn() } }));
beforeEach(() => { jest.clearAllMocks(); native.open.mockResolvedValue({ handle: 7, pages: 3 }); });
test('rejects remote files without invoking native code', async () => {
    await expect(openPdfSearch('https://example.test/a.pdf')).rejects.toThrow('local');
    expect(native.open).not.toHaveBeenCalled();
});
test('closes each document once and rejects late results', async () => {
    let finish;
    native.searchPage.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const document = await openPdfSearch('/tmp/example.pdf');
    const request = document.searchPage(1, 'alpha');
    document.close(); document.close();
    finish({ matches: [], hasText: true, truncated: false });
    await expect(request).rejects.toThrow('closed');
    expect(native.close).toHaveBeenCalledTimes(1);
    await expect(document.searchPage(1, 'beta')).rejects.toThrow('closed');
});
test('validates page and query limits before native execution', async () => {
    const document = await openPdfSearch('/tmp/example.pdf');
    await expect(document.searchPage(4, 'alpha')).rejects.toThrow('page');
    await expect(document.searchPage(1, 'a'.repeat(513))).rejects.toThrow('512');
    expect(await document.searchPage(1, '')).toEqual({ matches: [], hasText: false, truncated: false });
    expect(native.searchPage).not.toHaveBeenCalled();
    document.close();
});
test('searches Unicode, literal regex characters and multiline phrases', () => {
    expect(searchText('КНИГА книга', 2, 'книга', false).matches.map(x => x.start)).toEqual([0, 6]);
    expect(searchText('КНИГА книга', 2, 'книга', true).matches).toHaveLength(1);
    expect(searchText('a.b axb', 1, 'a.b', false).matches).toHaveLength(1);
    expect(searchText('across\ntwo lines', 1, 'across two', false).matches[0].length).toBe(10);
});
test('bounds results and distinguishes a page without text', () => {
    const found = searchText('a '.repeat(300), 1, 'a', false);
    expect(found.matches).toHaveLength(256); expect(found.truncated).toBe(true);
    expect(searchText('', 1, 'a', false).hasText).toBe(false);
});
test('highlights exact substrings across text items and escapes PDF HTML', () => {
    const matches = [{ start: 2, length: 5 }];
    expect(highlightText('<&alpha>', 0, matches, matches[0])).toContain('&lt;&amp;<mark');
    expect(highlightText('<&alpha>', 0, matches, matches[0])).toContain('>alpha</mark>&gt;');
    expect(highlightText('ha tail', 5, matches)).toContain('>ha</mark> tail');
});

test('preserves native outline titles with separators and normalizes page indices', () => {
    const { parsePdfEvent } = require('../src/document');
    const event = parsePdfEvent('loadComplete|3|600|800|[{"title":"A | B","pageIdx":"1","children":[]}]');
    expect(event.outline).toEqual([{ title: 'A | B', pageIdx: 1, children: [] }]);
});

test('honours custom zoom bounds', () => {
    const { clampScale } = require('../src/document');
    expect(clampScale(5, 1, 6)).toBe(5);
    expect(clampScale(0.1, 1, 6)).toBe(1);
});

test('reads lazy metadata and bounds thumbnail dimensions on the same handle', async () => {
    const document = await openPdfSearch('/tmp/example.pdf');
    native.getPageInfo.mockResolvedValue({ width: 600, height: 800, rotation: 90, hasText: true });
    native.renderThumbnail.mockResolvedValue({ uri: 'data:image/png;base64,a', width: 512, height: 384 });
    expect((await document.getPageInfo(2)).rotation).toBe(90);
    await document.renderThumbnail(2, 2000);
    expect(native.getPageInfo).toHaveBeenCalledWith(7, 2);
    expect(native.renderThumbnail).toHaveBeenCalledWith(7, 2, 512);
    await expect(document.getPageInfo(4)).rejects.toThrow('page');
    await expect(document.renderThumbnail(1, NaN)).rejects.toThrow('size');
    document.close();
    await expect(document.renderThumbnail(1)).rejects.toThrow('closed');
});

test('does not expose metadata that completed after close', async () => {
    let finish;
    native.getPageInfo.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const document = await openPdfSearch('/tmp/example.pdf');
    const result = document.getPageInfo(1);
    document.close();
    finish({ width: 600, height: 800, rotation: 0, hasText: false });
    await expect(result).rejects.toThrow('closed');
});

test('reads text only from the requested page and rejects invalid or closed requests', async () => {
    native.getPageText.mockResolvedValue('Текст\nсторінки');
    const document = await openPdfSearch('/tmp/example.pdf');
    expect(await document.getPageText(2)).toBe('Текст\nсторінки');
    expect(native.getPageText).toHaveBeenCalledWith(7, 2);
    await expect(document.getPageText(0)).rejects.toThrow('page');
    await expect(document.getPageText(1.5)).rejects.toThrow('page');
    await expect(document.getPageText(4)).rejects.toThrow('page');
    document.close();
    await expect(document.getPageText(1)).rejects.toThrow('closed');
    expect(native.getPageText).toHaveBeenCalledTimes(1);
});

test('discards extracted text after the document closes', async () => {
    let finish;
    native.getPageText.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const document = await openPdfSearch('/tmp/example.pdf');
    const text = document.getPageText(1);
    document.close();
    finish('old page');
    await expect(text).rejects.toThrow('closed');
});
