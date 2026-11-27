/** @jest-environment jsdom */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { usePageTap } from '../src/use-page-tap.web';

global.IS_REACT_ACT_ENVIRONMENT = true;
let tree;
let handlers;
let onTap;
const target = document.createElement('div');
const event = extra => ({ isPrimary: true, button: 0, pointerId: 1, clientX: 30, clientY: 50, detail: 1, target,
    currentTarget: { getBoundingClientRect: () => ({ left: 10, top: 20 }) }, ...extra });
function Fixture() { handlers = usePageTap(onTap); return null; }
beforeEach(async () => {
    jest.useFakeTimers();
    onTap = jest.fn();
    window.getSelection().removeAllRanges();
    await act(() => { tree = create(<Fixture />); });
});
afterEach(async () => { await act(() => tree.unmount()); jest.useRealTimers(); });
function tap(extra) { handlers.onPointerDown(event(extra)); handlers.onClick(event(extra)); }
test('emits a single tap relative to the page after confirmation', () => {
    tap(); expect(onTap).not.toHaveBeenCalled();
    jest.advanceTimersByTime(350); expect(onTap).toHaveBeenCalledWith(20, 30);
});
test('double click cancels single tap', () => {
    tap(); jest.advanceTimersByTime(100); tap({ detail: 2 }); handlers.onDoubleClick();
    jest.runAllTimers(); expect(onTap).not.toHaveBeenCalled();
});
test.each(['scroll', 'pointercancel', 'drag', 'pinch', 'longpress', 'link', 'selection'])('%s does not emit a page tap', kind => {
    handlers.onPointerDown(event());
    if (kind === 'drag') handlers.onPointerMove(event({ clientX: 60 }));
    if (kind === 'pinch') handlers.onPointerDown(event({ isPrimary: false, pointerId: 2 }));
    if (kind === 'pointercancel') handlers.onPointerCancel();
    if (kind === 'longpress') jest.advanceTimersByTime(600);
    if (kind === 'selection') {
        const text = document.createTextNode('selected text'); document.body.appendChild(text);
        const range = document.createRange(); range.selectNodeContents(text); window.getSelection().addRange(range);
    }
    handlers.onClick(event({ target: kind === 'link' ? document.createElement('a') : target }));
    if (kind === 'scroll') document.dispatchEvent(new Event('scroll'));
    jest.runAllTimers(); expect(onTap).not.toHaveBeenCalled();
});
test('unmount cancels queued callback', async () => {
    tap(); await act(() => tree.unmount()); jest.runAllTimers(); expect(onTap).not.toHaveBeenCalled();
});
