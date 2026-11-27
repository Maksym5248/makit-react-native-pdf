package org.ammo.pdf;

import android.content.Context;
import android.net.Uri;
import com.github.barteksc.pdfviewer.source.DocumentSource;
import com.github.barteksc.pdfviewer.source.UriSource;
import io.legere.pdfiumandroid.PdfDocument;
import io.legere.pdfiumandroid.PdfPage;
import io.legere.pdfiumandroid.PdfiumCore;
import java.io.IOException;

/** Applies viewing rotation before the renderer measures pages. Never saves the document. */
final class RotatedDocumentSource implements DocumentSource {
    static { System.loadLibrary("ammopdfrotation"); }
    private final Uri uri;
    private final int rotation;

    RotatedDocumentSource(Uri uri, int rotation) {
        this.uri = uri;
        this.rotation = rotation;
    }

    private static native void setPageRotation(long page, int quarterTurns);

    @Override public PdfDocument createDocument(Context context, PdfiumCore core, String password) throws IOException {
        PdfDocument document = new UriSource(uri).createDocument(context, core, password);
        try {
            // Match PDFiumAndroid's global lock: PDFium is not thread safe across documents.
            synchronized (PdfiumCore.Companion.getLock()) {
                for (int index = 0; index < document.getPageCount(); index++) {
                    try (PdfPage page = document.openPage(index)) {
                        setPageRotation(page.getPagePtr(), (page.getPageRotation() + rotation / 90) % 4);
                    }
                }
            }
            return document;
        } catch (Exception error) {
            document.close();
            throw new IOException("Cannot rotate PDF", error);
        }
    }
}
