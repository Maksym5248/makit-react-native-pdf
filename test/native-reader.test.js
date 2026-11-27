import React from 'react';
import { Platform } from 'react-native';
import { act, create } from 'react-test-renderer';
import { PdfReader } from '../src/pdf-reader';
import { Commands } from '../src/native/AmmoPDFPdfNativeComponent';

jest.mock('../src/native/AmmoPDFPdfNativeComponent', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: React.forwardRef((props, ref) => React.createElement('NativePdf', { ...props, ref })),
        Commands: { setNativePage: jest.fn() },
    };
});
global.IS_REACT_ACT_ENVIRONMENT = true;
let tree;
afterEach(async () => {
    if (tree) await act(() => tree.unmount());
    tree = undefined;
    jest.clearAllMocks();
    Platform.OS = 'android';
});
const mount = async props => {
    await act(() => { tree = create(React.createElement(PdfReader, props), { createNodeMock: () => ({ native: true }) }); });
};
const event = message => ({ nativeEvent: { message } });

test('rejects a remote source without mounting a renderer', async () => {
    const onError = jest.fn();
    await mount({ sourceUri: 'https://example.com/book.pdf', onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType('NativePdf')).toHaveLength(0);
});

test('defers a page command until load and clamps it to document bounds', async () => {
    const ref = React.createRef();
    const onLoadComplete = jest.fn();
    await mount({ sourceUri: 'file:///tmp/book.pdf', ref, onLoadComplete });
    await act(() => ref.current.setPage(99));
    expect(Commands.setNativePage).not.toHaveBeenCalled();
    await act(() => tree.root.findByType('NativePdf').props.onChange(event('loadComplete|8|600|800')));
    expect(Commands.setNativePage).toHaveBeenCalledWith(expect.anything(), 8);
    expect(onLoadComplete).toHaveBeenCalledWith(8, 'file:///tmp/book.pdf', { width: 600, height: 800 });
});

test('ignores late events from the replaced document', async () => {
    const onLoadComplete = jest.fn();
    await mount({ sourceUri: '/tmp/first.pdf', onLoadComplete });
    const staleHandler = tree.root.findByType('NativePdf').props.onChange;
    await act(() => tree.update(React.createElement(PdfReader, { sourceUri: '/tmp/second.pdf', onLoadComplete })));
    await act(() => staleHandler(event('loadComplete|8|600|800')));
    expect(onLoadComplete).not.toHaveBeenCalled();
    await act(() => tree.root.findByType('NativePdf').props.onChange(event('loadComplete|2|400|600')));
    expect(onLoadComplete).toHaveBeenCalledWith(2, '/tmp/second.pdf', { width: 400, height: 600 });
});

test('keeps imperative commands scoped to their own Reader or thumbnail', async () => {
    const reader = React.createRef();
    const thumbnail = React.createRef();
    await act(() => { tree = create(React.createElement(React.Fragment, null,
        React.createElement(PdfReader, { ref: reader, sourceUri: '/tmp/reader.pdf' }),
        React.createElement(PdfReader, { ref: thumbnail, sourceUri: '/tmp/thumbnail.pdf', singlePage: true }),
    ), { createNodeMock: element => ({ path: element.props.path }) }); });
    for (const node of tree.root.findAllByType('NativePdf')) await act(() => node.props.onChange(event('loadComplete|8|600|800')));
    await act(() => reader.current.setPage(3));
    expect(Commands.setNativePage).toHaveBeenLastCalledWith({ path: '/tmp/reader.pdf' }, 3);
    await act(() => thumbnail.current.setPage(2));
    expect(Commands.setNativePage).toHaveBeenLastCalledWith({ path: '/tmp/thumbnail.pdf' }, 2);
});

test('forwards native file errors without reporting successful loading', async () => {
    const onError = jest.fn();
    const onLoadComplete = jest.fn();
    await mount({ sourceUri: '/tmp/missing.pdf', onError, onLoadComplete });
    await act(() => tree.root.findByType('NativePdf').props.onChange(event('error|File not found')));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'File not found' }));
    expect(onLoadComplete).not.toHaveBeenCalled();
});


test('preserves scale, tap, full link URL and outline callbacks', async () => {
    const onScaleChanged = jest.fn(), onPageSingleTap = jest.fn(), onPressLink = jest.fn(), onLoadComplete = jest.fn();
    await mount({ sourceUri: '/tmp/book.pdf', onScaleChanged, onPageSingleTap, onPressLink, onLoadComplete });
    const notify = tree.root.findByType('NativePdf').props.onChange;
    await act(() => {
        notify(event('scaleChanged|1.5'));
        notify(event('pageSingleTap|2|12|34'));
        notify(event('linkPressed|https://example.invalid/a|b'));
        notify(event('loadComplete|3|600|800|[{"title":"Chapter","pageIdx":1,"children":[]}]'));
    });
    expect(onScaleChanged).toHaveBeenCalledWith(1.5);
    expect(onPageSingleTap).toHaveBeenCalledWith(2, 12, 34);
    expect(onPressLink).toHaveBeenCalledWith('https://example.invalid/a|b');
    expect(onLoadComplete.mock.calls[0][3]).toEqual([{ title: 'Chapter', pageIdx: 1, children: [] }]);
});

test('updates annotations, scroll lock and gesture flags without replacing the reader', async () => {
    const props = { sourceUri: '/tmp/book.pdf', enableAnnotationRendering: false, scrollEnabled: false, enableDoubleTapZoom: false };
    await mount(props);
    const before = tree.root.findByType('NativePdf');
    expect(before.props.enableAnnotationRendering).toBe(false);
    expect(before.props.scrollEnabled).toBe(false);
    expect(before.props.enableDoubleTapZoom).toBe(false);
    await act(() => tree.update(React.createElement(PdfReader, { ...props, enableAnnotationRendering: true, scrollEnabled: true })));
    expect(tree.root.findByType('NativePdf')).toBe(before);
    expect(before.props.enableAnnotationRendering).toBe(true);
    expect(before.props.scrollEnabled).toBe(true);
});


test('forwards consecutive page notifications including even pages in both directions', async () => {
    const onPageChanged = jest.fn();
    await mount({ sourceUri: '/tmp/scroll.pdf', onPageChanged });
    const notify = message => tree.root.findByType('NativePdf').props.onChange(event(message));
    await act(() => notify('loadComplete|6|600|800'));
    for (const page of [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]) {
        await act(() => notify(`pageChanged|${page}|6`));
    }
    expect(onPageChanged.mock.calls).toEqual([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map(page => [page, 6]));
});

test('keeps a custom loader until the first native render, then resets for a new file', async () => {
    const renderLoading = () => React.createElement('CustomLoader');
    await mount({ sourceUri: '/tmp/first.pdf', renderLoading });
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(1);
    await act(() => tree.root.findByType('NativePdf').props.onChange(event('loadComplete|8|600|800')));
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(1);
    await act(() => tree.root.findByType('NativePdf').props.onChange(event('renderReady')));
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(0);
    await act(() => tree.update(React.createElement(PdfReader, { sourceUri: '/tmp/second.pdf', renderLoading })));
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(1);
    await act(() => tree.root.findByType('NativePdf').props.onChange(event('error|Invalid PDF')));
    expect(tree.root.findAllByType('CustomLoader')).toHaveLength(0);
});


test('iOS clears the loader on PDFKit document readiness without a separate render event', async () => {
    Platform.OS = 'ios';
    await mount({ sourceUri: '/tmp/first.pdf' });
    expect(tree.root.findAllByType('ActivityIndicator')).toHaveLength(1);
    await act(() => tree.root.findByType('NativePdf').props.onChange(event('loadComplete|8|600|800')));
    expect(tree.root.findAllByType('ActivityIndicator')).toHaveLength(0);
    await act(() => tree.update(React.createElement(PdfReader, { sourceUri: '/tmp/second.pdf' })));
    expect(tree.root.findAllByType('ActivityIndicator')).toHaveLength(1);
    await act(() => tree.root.findByType('NativePdf').props.onChange(event('loadComplete|3|600|800')));
    expect(tree.root.findAllByType('ActivityIndicator')).toHaveLength(0);
});


test('forwards highlight viewport insets without adding document padding', async () => {
    await mount({ sourceUri: '/tmp/book.pdf', activeMatch: 0, highlightContentInsets: { top: 120, bottom: 80 } });
    expect(JSON.parse(tree.root.findByType('NativePdf').props.highlights).insets).toEqual({ top: 120, bottom: 80 });
});
