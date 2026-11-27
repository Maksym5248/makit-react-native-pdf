/** @jest-environment jsdom */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { PdfReader } from '../src/pdf-reader.web';
import { PdfPage } from '../src/pdf-page.web';

jest.mock('react-pdf', () => ({
    pdfjs: { GlobalWorkerOptions: {}, VerbosityLevel: { ERRORS: 0 }, PDFWorker: class { static fromPort() { return new this(); } destroy() {} } },
    Document: props => require('react').createElement('Document', props),
    Page: props => require('react').createElement('Page', props),
}));
global.IS_REACT_ACT_ENVIRONMENT = true;
let tree;
let observer;
let container;
beforeEach(() => {
    global.Worker = class { terminate() {} };
    container = { clientWidth: 600, clientHeight: 800, scrollTop: 0, scrollLeft: 0 };
    global.ResizeObserver = class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} };
    global.IntersectionObserver = class { constructor(callback) { observer = callback; } observe() {} disconnect() {} };
});
afterEach(async () => { if (tree) await act(() => tree.unmount()); tree = undefined; });
const mount = async props => {
    await act(() => { tree = create(React.createElement(PdfReader, props), { createNodeMock: element => element.props['data-page-number'] ? { offsetLeft: (element.props['data-page-number'] - 1) * 610, offsetTop: (element.props['data-page-number'] - 1) * 810, style: {} } : container }); });
};
const pdf = { getOutline: async () => [], numPages: 8, getPage: async () => ({ rotate: 0, getViewport: () => ({ width: 600, height: 800 }) }) };

test('does not mount PDF.js for a remote file', async () => {
    const onError = jest.fn();
    await mount({ sourceUri: 'https://example.com/book.pdf', onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType('Document')).toHaveLength(0);
});

test('honours a page command issued before the document is ready', async () => {
    const ref = React.createRef();
    const onPageChanged = jest.fn();
    await mount({ sourceUri: 'blob:https://ammo.test/book', ref, onPageChanged });
    await act(() => ref.current.setPage(6));
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    expect(container.scrollTop).toBe(4050);
    expect(onPageChanged).toHaveBeenLastCalledWith(6, 8);
});

test('scrolling updates current page without snapping back to its top', async () => {
    const onPageChanged = jest.fn();
    await mount({ sourceUri: 'blob:https://ammo.test/book', onPageChanged });
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    container.scrollTop = 1000;
    await act(() => observer([{ isIntersecting: true, intersectionRatio: 0.8, target: { getAttribute: () => '2' } }]));
    expect(onPageChanged).toHaveBeenLastCalledWith(2, 8);
    expect(container.scrollTop).toBe(1000);
});

test('ignores asynchronous document completion after source replacement', async () => {
    const onLoadComplete = jest.fn();
    await mount({ sourceUri: 'blob:https://ammo.test/old', onLoadComplete });
    const oldLoad = tree.root.findByType('Document').props.onLoadSuccess;
    await act(() => tree.update(React.createElement(PdfReader, { sourceUri: 'blob:https://ammo.test/new', onLoadComplete })));
    await act(() => oldLoad(pdf));
    expect(onLoadComplete).not.toHaveBeenCalled();
});

test('reports a blocked local worker instead of leaving the reader loading', async () => {
    global.Worker = class { constructor() { throw new Error('Worker blocked'); } };
    const onError = jest.fn();
    await mount({ sourceUri: 'blob:https://ammo.test/book', onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Worker blocked' }));
    expect(tree.root.findAllByType('Document')).toHaveLength(0);
});

test('terminates the document worker when the reader closes', async () => {
    const terminate = jest.fn();
    global.Worker = class { terminate = terminate; };
    await mount({ sourceUri: 'blob:https://ammo.test/book' });
    await act(() => tree.unmount());
    tree = undefined;
    expect(terminate).toHaveBeenCalledTimes(1);
});

test('horizontal paging navigates on the horizontal axis and enables page snapping', async () => {
    const ref = React.createRef();
    await mount({ sourceUri: 'blob:https://ammo.test/book', ref, horizontal: true, enablePaging: true });
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    await act(() => ref.current.setPage(3));
    expect(container.scrollLeft).toBe(1220);
    expect(container.scrollTop).toBe(0);
    expect(tree.root.findAllByType('div').some(element => element.props.style?.scrollSnapType === 'x mandatory')).toBe(true);
});

test('fit-height uses the viewport height and rotation adds to the intrinsic page rotation', async () => {
    await mount({ sourceUri: 'blob:https://ammo.test/book', fitPolicy: 1, rotation: 90 });
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    const page = tree.root.findAllByType('Page')[0];
    await act(() => page.props.onLoadSuccess({ rotate: 90, getViewport: ({ rotation }) => ({ width: rotation === 180 ? 600 : 800, height: rotation === 180 ? 800 : 600 }) }));
    const updated = tree.root.findAllByType('Page')[0];
    expect(updated.props.rotate).toBe(180);
    expect(updated.props.width).toBe(600);
});

test('changing reading direction keeps the page reached by scrolling', async () => {
    const props = { sourceUri: 'blob:https://ammo.test/book' };
    await mount(props);
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    await act(() => observer([{ isIntersecting: true, intersectionRatio: 0.8, target: { getAttribute: () => '4' } }]));
    await act(() => tree.update(React.createElement(PdfReader, { ...props, horizontal: true })));
    expect(container.scrollLeft).toBe(1830);
});


test('wrong password reports once and a changed password reopens the worker/document', async () => {
    const onError = jest.fn();
    await mount({ sourceUri: 'blob:https://reader.test/book', password: 'wrong', onError });
    const old = tree.root.findByType('Document').props;
    const retry = jest.fn();
    await act(() => old.onPassword(retry, 2));
    expect(retry).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    await act(() => tree.update(React.createElement(PdfReader, { sourceUri: 'blob:https://reader.test/book', password: 'correct', onError })));
    expect(tree.root.findByType('Document').props.options.password).toBe('correct');
});

test('RTL reverses page slots while preserving logical page numbers', async () => {
    await mount({ sourceUri: 'blob:https://reader.test/book', enableRTL: true });
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    expect(tree.root.findAllByType('div').filter(node => node.props['data-page-number']).map(node => node.props['data-page-number'])).toEqual([8,7,6,5,4,3,2,1]);
});

test('rotation recalculates an already loaded page without requiring another load callback', async () => {
    await mount({ sourceUri: 'blob:https://reader.test/book' });
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    await act(() => tree.root.findAllByType('Page')[0].props.onLoadSuccess({ rotate: 0, getViewport: ({ rotation }) => rotation === 90 ? { width: 800, height: 600 } : { width: 600, height: 800 } }));
    await act(() => tree.update(React.createElement(PdfReader, { sourceUri: 'blob:https://reader.test/book', rotation: 90, fitPolicy: 1 })));
    expect(tree.root.findAllByType('Page')[0].props.rotate).toBe(90);
    expect(tree.root.findAllByType('Page')[0].props.width).toBe(1066);
});

test('returns nested outline destinations and routes external links to the consumer', async () => {
    const onLoadComplete = jest.fn();
    const onPressLink = jest.fn();
    await mount({ sourceUri: 'blob:https://reader.test/book', onLoadComplete, onPressLink });
    await act(() => tree.root.findByType('Document').props.onLoadSuccess({ ...pdf, getOutline: async () => [{ title: 'Chapter', dest: [2], items: [] }] }));
    expect(onLoadComplete.mock.calls[0][3]).toEqual([{ title: 'Chapter', pageIdx: 2, children: [] }]);
    const anchor = document.createElement('a');
    anchor.href = 'https://example.invalid/test';
    const preventDefault = jest.fn();
    tree.root.findAllByType('div').find(node => node.props.onClickCapture).props.onClickCapture({ target: anchor, preventDefault, stopPropagation: jest.fn() });
    expect(preventDefault).toHaveBeenCalled();
    expect(onPressLink).toHaveBeenCalledWith('https://example.invalid/test');
});

test('single-page taps and internal links retain the portable callback/navigation contract', async () => {
    const onPageSingleTap = jest.fn(), onPageChanged = jest.fn();
    await mount({ sourceUri: 'blob:https://reader.test/book', singlePage: true, page: 2, onPageSingleTap, onPageChanged });
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    jest.useFakeTimers();
    const tapEvent = { isPrimary: true, button: 0, pointerId: 1, detail: 1, currentTarget: { getBoundingClientRect: () => ({ left: 10, top: 20 }) }, clientX: 40, clientY: 70 };
    tree.root.findByType('Page').props.onPointerDown(tapEvent);
    tree.root.findByType('Page').props.onClick(tapEvent);
    jest.advanceTimersByTime(350);
    jest.useRealTimers();
    expect(onPageSingleTap).toHaveBeenCalledWith(2, 30, 50);
    await act(() => tree.root.findByType('Document').props.onItemClick({ pageNumber: 4 }));
    expect(onPageChanged).toHaveBeenLastCalledWith(4, 8);
});

test('double click changes scale within the supplied bounds and reports it', async () => {
    const onScaleChanged = jest.fn();
    await mount({ sourceUri: 'blob:https://reader.test/book', maxScale: 1.2, onScaleChanged });
    await act(() => tree.root.findAllByType('div').find(node => node.props.onDoubleClick).props.onDoubleClick({ target: document.createElement('div') }));
    expect(onScaleChanged).toHaveBeenLastCalledWith(1.2);
});

test('reveals an active search match inside the PDF viewport without scrolling the outer app', async () => {
    const match = { page: 1, start: 0, length: 5, text: 'alpha', rects: [] };
    await mount({ sourceUri: 'blob:https://ammo.test/book', highlights: [match], activeMatch: 0 });
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    container.getBoundingClientRect = () => ({ top: 100, bottom: 900, left: 0, right: 600, width: 600, height: 800 });
    const activeElement = { getAttribute: () => '0', getBoundingClientRect: () => ({ top: 1200, bottom: 1220, left: 20, right: 100, width: 80, height: 20 }) };
    const page = tree.root.findAllByType('Page')[0];
    page.props.inputRef.current = { querySelector: () => activeElement };
    await act(() => page.props.onRenderTextLayerSuccess());
    expect(container.scrollTop).toBe(1100);
    expect(container.scrollLeft).toBe(0);
    container.scrollTop = 1000;
    await act(() => page.props.onRenderTextLayerSuccess());
    expect(container.scrollTop).toBe(1000);
});

test('shows custom loading until the requested page has rendered, and clears it on errors', async () => {
    const renderLoading = () => React.createElement('CustomLoader');
    await mount({ sourceUri: 'blob:https://ammo.test/book', page: 6, renderLoading });
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(1);
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(1);
    await act(() => tree.root.findAllByType('Page').find(page => page.props.pageNumber === 6).props.onRenderSuccess());
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(0);
    await act(() => tree.update(React.createElement(PdfReader, { sourceUri: 'blob:https://ammo.test/next', renderLoading })));
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(1);
    await act(() => tree.root.findByType('Document').props.onLoadError(new Error('Invalid PDF')));
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(0);
});


test('reveals an active match at the requested top inset without changing PDF layout', async () => {
    container.getBoundingClientRect = () => ({ top: 0, left: 0, right: 600, bottom: 800, width: 600, height: 800 });
    await mount({ sourceUri: 'blob:https://ammo.test/book', highlightContentInsets: { top: 120, bottom: 80 } });
    await act(() => tree.root.findByType('Document').props.onLoadSuccess(pdf));
    const match = { getBoundingClientRect: () => ({ top: 450, bottom: 470, left: 100, right: 200, height: 20 }) };
    await act(() => tree.root.findAllByType(PdfPage)[0].props.onActiveMatch(match));
    expect(container.scrollTop).toBe(330);
    expect(container.scrollLeft).toBe(0);
});
