package org.ammo.pdf;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import android.graphics.Rect;
import android.graphics.RectF;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import com.facebook.react.bridge.*;
import io.legere.pdfiumandroid.*;
import java.io.File;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Each search owns a document; rendering never shares PDFium page handles with this queue. */
public final class AmmoPdfSearchModule extends NativeAmmoPdfSearchSpec {
    private final ExecutorService queue = Executors.newSingleThreadExecutor();
    private final Map<Integer, PdfDocument> documents = new HashMap<>();
    private final Set<Integer> closedDocuments = ConcurrentHashMap.newKeySet();
    private int nextHandle = 1;

    public AmmoPdfSearchModule(ReactApplicationContext context) { super(context); }
    @Override public String getName() { return "AmmoPdfSearch"; }

    @Override public void open(String path, String password, Promise promise) {
        queue.execute(() -> {
            ParcelFileDescriptor descriptor = null;
            try {
                if (path.startsWith("content://")) {
                    descriptor = getReactApplicationContext().getContentResolver().openFileDescriptor(Uri.parse(path), "r");
                } else if (path.startsWith("/") && !path.startsWith("//")) {
                    descriptor = ParcelFileDescriptor.open(new File(path), ParcelFileDescriptor.MODE_READ_ONLY);
                } else throw new IllegalArgumentException("A local PDF path is required");
                if (descriptor == null) throw new IllegalArgumentException("Cannot open PDF");
                PdfDocument document = new PdfiumCore().newDocument(descriptor, password);
                int handle = nextHandle++;
                documents.put(handle, document);
                WritableMap result = Arguments.createMap();
                result.putDouble("handle", handle);
                result.putDouble("pages", document.getPageCount());
                promise.resolve(result);
            } catch (Exception error) {
                if (descriptor != null) try { descriptor.close(); } catch (Exception ignored) {}
                promise.reject("PDF_OPEN", error);
            }
        });
    }

    @Override public void searchPage(double handle, double pageNumber, String query, boolean caseSensitive, Promise promise) {
        queue.execute(() -> {
            try {
                PdfDocument document = closedDocuments.contains((int) handle) ? null : documents.get((int) handle);
                if (document == null) throw new IllegalStateException("PDF is closed");
                if (pageNumber != Math.floor(pageNumber) || pageNumber < 1 || pageNumber > document.getPageCount()) throw new IllegalArgumentException("Invalid page");
                if (query.isEmpty() || query.length() > 512) throw new IllegalArgumentException("Invalid query");
                WritableArray matches = Arguments.createArray();
                boolean truncated = false;
                boolean hasText;
                try (PdfPage page = document.openPage((int) pageNumber - 1); PdfTextPage text = page.openTextPage()) {
                    int count = text.textPageCountChars();
                    hasText = count > 0;
                    try (FindResult find = text.findStart(query, caseSensitive ? Collections.singleton(FindFlags.MatchCase) : Collections.emptySet(), 0)) {
                        while (find.findNext()) {
                            if (matches.size() == 256) { truncated = true; break; }
                            int start = find.getSchResultIndex();
                            int length = find.getSchCount();
                            WritableMap match = Arguments.createMap();
                            match.putDouble("page", pageNumber);
                            match.putDouble("start", start);
                            match.putDouble("length", length);
                            int contextStart = Math.max(0, start - 40);
                            match.putString("text", text.textPageGetText(contextStart, Math.min(count - contextStart, length + 80)));
                            WritableArray rects = Arguments.createArray();
                            int rectCount = text.textPageCountRects(start, length);
                            for (int i = 0; i < Math.min(rectCount, 128); i++) {
                                RectF bounds = text.textPageGetRect(i);
                                Rect device = page.mapRectToDevice(0, 0, 100000, 100000, 0, bounds);
                                WritableMap rect = Arguments.createMap();
                                rect.putDouble("x", Math.min(device.left, device.right) / 100000.0);
                                rect.putDouble("y", Math.min(device.top, device.bottom) / 100000.0);
                                rect.putDouble("width", Math.abs(device.width()) / 100000.0);
                                rect.putDouble("height", Math.abs(device.height()) / 100000.0);
                                rects.pushMap(rect);
                            }
                            match.putArray("rects", rects);
                            matches.pushMap(match);
                        }
                    }
                }
                WritableMap result = Arguments.createMap();
                result.putArray("matches", matches);
                result.putBoolean("hasText", hasText);
                result.putBoolean("truncated", truncated);
                promise.resolve(result);
            } catch (Exception error) { promise.reject("PDF_SEARCH", error); }
        });
    }

    @Override public void getPageText(double handle, double pageNumber, Promise promise) {
        queue.execute(() -> {
            try {
                PdfDocument document = closedDocuments.contains((int) handle) ? null : documents.get((int) handle);
                if (document == null || pageNumber != Math.floor(pageNumber) || pageNumber < 1 || pageNumber > document.getPageCount()) throw new IllegalArgumentException("Invalid document or page");
                try (PdfPage page = document.openPage((int) pageNumber - 1); PdfTextPage text = page.openTextPage()) {
                    int count = text.textPageCountChars();
                    promise.resolve(count > 0 ? text.textPageGetText(0, count) : "");
                }
            } catch (Exception error) { promise.reject("PDF_TEXT", error); }
        });
    }

    @Override public void getPageInfo(double handle, double pageNumber, Promise promise) {
        queue.execute(() -> {
            try {
                PdfDocument document = closedDocuments.contains((int) handle) ? null : documents.get((int) handle);
                if (document == null || pageNumber != Math.floor(pageNumber) || pageNumber < 1 || pageNumber > document.getPageCount()) throw new IllegalArgumentException("Invalid document or page");
                try (PdfPage page = document.openPage((int) pageNumber - 1); PdfTextPage text = page.openTextPage()) {
                    RectF crop = page.getPageCropBox();
                    if (crop == null || Math.abs(crop.width()) == 0 || Math.abs(crop.height()) == 0) crop = page.getPageMediaBox();
                    WritableMap result = Arguments.createMap();
                    int rotation = page.getPageRotation() * 90;
                    result.putDouble("width", Math.abs(crop.width()));
                    result.putDouble("height", Math.abs(crop.height()));
                    result.putDouble("rotation", rotation);
                    result.putBoolean("hasText", text.textPageCountChars() > 0);
                    promise.resolve(result);
                }
            } catch (Exception error) { promise.reject("PDF_PAGE", error); }
        });
    }

    @Override public void renderThumbnail(double handle, double pageNumber, double maxSize, Promise promise) {
        queue.execute(() -> {
            Bitmap bitmap = null;
            try {
                PdfDocument document = closedDocuments.contains((int) handle) ? null : documents.get((int) handle);
                if (document == null || pageNumber != Math.floor(pageNumber) || pageNumber < 1 || pageNumber > document.getPageCount() || !Double.isFinite(maxSize) || maxSize < 1) throw new IllegalArgumentException("Invalid document, page or size");
                try (PdfPage page = document.openPage((int) pageNumber - 1)) {
                    double ratio = Math.min(512, Math.ceil(maxSize)) / Math.max(page.getPageWidthPoint(), page.getPageHeightPoint());
                    int width = Math.max(1, (int) Math.floor(page.getPageWidthPoint() * ratio));
                    int height = Math.max(1, (int) Math.floor(page.getPageHeightPoint() * ratio));
                    bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                    page.renderPageBitmap(bitmap, 0, 0, width, height, true, false, Color.WHITE, Color.WHITE);
                    ByteArrayOutputStream png = new ByteArrayOutputStream();
                    if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, png)) throw new IllegalStateException("Cannot encode thumbnail");
                    WritableMap result = Arguments.createMap();
                    result.putString("uri", "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP));
                    result.putDouble("width", width);
                    result.putDouble("height", height);
                    promise.resolve(result);
                }
            } catch (Exception error) { promise.reject("PDF_THUMBNAIL", error); }
            finally { if (bitmap != null) bitmap.recycle(); }
        });
    }

    @Override public void close(double handle) {
        // Mark synchronously so work queued behind another page does not start after close.
        closedDocuments.add((int) handle);
        queue.execute(() -> {
            PdfDocument document = documents.remove((int) handle);
            if (document != null) document.close();
            closedDocuments.remove((int) handle);
        });
    }
    @Override public void invalidate() {
        queue.execute(() -> { for (PdfDocument document : documents.values()) document.close(); documents.clear(); });
        queue.shutdown();
        super.invalidate();
    }
}
