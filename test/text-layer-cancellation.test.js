/** @jest-environment jsdom */
import React from 'react';
import { act, create } from 'react-test-renderer';
import TextLayer from '../node_modules/react-pdf/dist/cjs/Page/TextLayer';

let mockContext;
const mockTasks = [];
jest.mock('pdfjs-dist', () => ({
    TextLayer: class {
        constructor() {
            this.promise = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
            mockTasks.push(this);
        }
        render() { return this.promise; }
        cancel() { this.reject(Object.assign(new Error('TextLayer task cancelled.'), { name: 'AbortException' })); }
    },
}));
jest.mock('../node_modules/react-pdf/dist/cjs/shared/hooks/usePageContext', () => ({
    __esModule: true, default: () => mockContext,
}));
global.IS_REACT_ACT_ENVIRONMENT = true;
let tree;
let warn;
beforeEach(() => {
    mockTasks.length = 0;
    document.body.style.setProperty('--react-pdf-text-layer', '1');
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockContext = {
        page: { getTextContent: async () => ({ items: [] }), streamTextContent: () => ({}), getViewport: () => ({}) },
        pageIndex: 0, pageNumber: 1, rotate: 0, scale: 1,
        onRenderTextLayerError: jest.fn(), onRenderTextLayerSuccess: jest.fn(),
    };
});
afterEach(async () => {
    if (tree) await act(() => tree.unmount());
    tree = undefined;
    warn.mockRestore();
});
const mount = async () => {
    await act(() => { tree = create(<TextLayer />, { createNodeMock: () => document.createElement('div') }); });
    expect(mockTasks).toHaveLength(1);
};

test('zoom cancels the old text layer without warning and the replacement still completes', async () => {
    await mount();
    mockContext = { ...mockContext, scale: 2 };
    await act(() => tree.update(<TextLayer />));
    expect(mockTasks).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
    expect(mockContext.onRenderTextLayerError).not.toHaveBeenCalled();
    await act(() => mockTasks[1].resolve());
    expect(mockContext.onRenderTextLayerSuccess).toHaveBeenCalledTimes(1);
});

test('unmount cancellation is silent', async () => {
    await mount();
    await act(() => tree.unmount());
    tree = undefined;
    expect(warn).not.toHaveBeenCalled();
    expect(mockContext.onRenderTextLayerError).not.toHaveBeenCalled();
});

test('a live task failure still reports its error', async () => {
    await mount();
    const error = new Error('Cannot render text');
    await act(() => mockTasks[0].reject(error));
    expect(mockContext.onRenderTextLayerError).toHaveBeenCalledWith(error);
});
