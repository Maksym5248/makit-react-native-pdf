import { isLocalPdfUri, getNativePdfPath, clampPage, clampScale, parsePdfEvent } from '../src/document';

describe('local PDF contract', () => {
    test.each(['https://example.com/a.pdf', 'http://example.com/a.pdf', '//example.com/a.pdf', 'data:application/pdf;base64,AA', '', 'a.pdf', 'file://server/a.pdf'])('rejects network or ambiguous source %s', uri => {
        expect(isLocalPdfUri(uri, 'native')).toBe(false);
        expect(isLocalPdfUri(uri, 'web')).toBe(false);
    });
    test.each(['/tmp/book.pdf', 'file:///tmp/book%20one.pdf', 'content://documents/document/42'])('accepts native local source %s', uri => {
        expect(isLocalPdfUri(uri, 'native')).toBe(true);
        expect(isLocalPdfUri(uri, 'web')).toBe(false);
    });
    test('accepts browser-owned blobs without accepting native file paths in browser', () => {
        expect(isLocalPdfUri('blob:https://ammo.example/abc', 'web')).toBe(true);
        expect(isLocalPdfUri('blob:null/abc', 'web')).toBe(true);
        expect(isLocalPdfUri('blob:https://ammo.example/abc', 'native')).toBe(false);
    });
    test('decodes file URIs once and preserves raw paths and content URIs', () => {
        expect(getNativePdfPath('file:///tmp/100%25%20book.pdf')).toBe('/tmp/100% book.pdf');
        expect(getNativePdfPath('/tmp/100% book.pdf')).toBe('/tmp/100% book.pdf');
        expect(getNativePdfPath('content://documents/a%20b')).toBe('content://documents/a%20b');
    });
    test('normalizes invalid page and zoom requests', () => {
        expect(clampPage(NaN, 8)).toBe(1);
        expect(clampPage(100, 8)).toBe(8);
        expect(clampPage(-4)).toBe(1);
        expect(clampPage(4.8)).toBe(4);
        expect(clampScale(Infinity)).toBe(1);
        expect(clampScale(0)).toBe(0.6);
    });
    test('parses events without leaking malformed native values to application progress', () => {
        expect(parsePdfEvent('loadComplete|8|600|800|[]')).toEqual({ type: 'load', total: 8, width: 600, height: 800, outline: [] });
        expect(parsePdfEvent('pageChanged|3|8')).toEqual({ type: 'page', page: 3, total: 8 });
        expect(parsePdfEvent('pageChanged|9|8')).toBeUndefined();
        expect(parsePdfEvent('loadComplete|NaN|0|0')).toBeUndefined();
        expect(parsePdfEvent('error|missing|file').error.message).toBe('missing|file');
    });
});
