import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

/** Qualify a page tap without taking ownership of PDF.js selection or links. */
export function usePageTap(onTap: (x: number, y: number) => void) {
    const callback = useRef(onTap);
    callback.current = onTap;
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const pointer = useRef<{ x: number; y: number; time: number } | undefined>(undefined);
    const eligible = useRef(false);
    const cancel = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = undefined;
        eligible.current = false;
    }, []);
    useEffect(() => {
        document.addEventListener('scroll', cancel, true);
        window.addEventListener('blur', cancel);
        return () => {
            cancel();
            document.removeEventListener('scroll', cancel, true);
            window.removeEventListener('blur', cancel);
        };
    }, [cancel]);
    return {
        onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
            clearTimeout(timer.current);
            eligible.current = event.isPrimary && event.button === 0 && window.getSelection()?.isCollapsed === true;
            if (!eligible.current) {
                cancel();
                pointer.current = undefined;
                return;
            }
            pointer.current = { x: event.clientX, y: event.clientY, time: Date.now() };
        },
        onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
            const start = pointer.current;
            if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) cancel();
        },
        onPointerCancel: cancel,
        onClick: (event: MouseEvent<HTMLDivElement>) => {
            const start = pointer.current;
            const allowed =
                eligible.current &&
                start &&
                Date.now() - start.time < 500 &&
                Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 8;
            cancel();
            if (!allowed || event.detail !== 1 || !window.getSelection()?.isCollapsed) return;
            if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, [contenteditable="true"]'))
                return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - bounds.left;
            const y = event.clientY - bounds.top;
            // Wait for the browser's double-click sequence before emitting a single tap.
            timer.current = setTimeout(() => {
                timer.current = undefined;
                if (window.getSelection()?.isCollapsed) callback.current(x, y);
            }, 350);
        },
        onDoubleClick: cancel,
    };
}
