package com.github.barteksc.pdfviewer;

import android.content.Context;
import android.os.Message;
import android.util.AttributeSet;

/**
 * Owns document lifetime across AndroidPdfViewer's UI and bitmap worker threads.
 * The pinned 4.0.1 renderer removes queued messages on recycle but does not join
 * the in-flight tile. Closing PDFium while that tile is rendering can crash.
 * Package access is needed because its rendering handler is not public API.
 */
public class PdfRenderView extends PDFView {
    private final Object documentLifetime = new Object();
    private Thread bitmapThread;
    private int generation;

    public PdfRenderView(Context context, AttributeSet attributes) {
        super(context, attributes);
    }

    /** Position in the renderer's document coordinates, including page spacing and alignment. */
    protected final void revealPagePoint(int page, float x, float y, float top, float left) {
        if (pdfFile == null || page < 0 || page >= getPageCount()) return;
        android.util.SizeF size = pdfFile.getScaledPageSize(page, getZoom());
        float primary = pdfFile.getPageOffset(page, getZoom());
        float secondary = pdfFile.getSecondaryPageOffset(page, getZoom());
        float documentX = (isSwipeVertical() ? secondary : primary) + x * size.getWidth();
        float documentY = (isSwipeVertical() ? primary : secondary) + y * size.getHeight();
        moveTo(left - documentX, top - documentY);
        // Search navigation has an explicit target. The viewport centre may be
        // on a neighbour when clamping at the document boundary or on short pages.
        showPage(page);
    }

    /** Called from onLoad, before PDFView queues the first page's tiles. */
    protected final void protectRenderingLifetime() {
        synchronized (documentLifetime) {
            RenderingHandler previous = renderingHandler;
            if (previous == null) return;
            previous.stop();
            previous.removeCallbacksAndMessages(null);
            renderingHandler = new RenderingHandler(previous.getLooper(), this) {
                @Override
                public void handleMessage(Message message) {
                    synchronized (documentLifetime) {
                        if (renderingHandler != this || isRecycled()) return;
                        bitmapThread = Thread.currentThread();
                        try {
                            super.handleMessage(message);
                        } finally {
                            bitmapThread = null;
                        }
                    }
                }
            };
            renderingHandler.start();
        }
    }

    @Override
    public boolean post(Runnable action) {
        // Drop callbacks from a tile belonging to a document replaced before UI delivery.
        if (Thread.currentThread() == bitmapThread) {
            int documentGeneration = generation;
            return super.post(() -> {
                if (generation == documentGeneration && !isRecycled()) action.run();
            });
        }
        return super.post(action);
    }

    @Override
    public void recycle() {
        synchronized (documentLifetime) {
            generation++;
            super.recycle();
        }
    }
}
