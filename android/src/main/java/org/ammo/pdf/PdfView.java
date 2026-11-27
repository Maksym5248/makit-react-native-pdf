/**
 * Copyright (c) 2017-present, Wonday (@wonday.org)
 * All rights reserved.
 *
 * This source code is licensed under the MIT-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

package org.ammo.pdf;

import java.io.File;

import android.content.Context;
import android.util.SizeF;
import android.view.View;
import android.view.ViewGroup;
import android.util.Log;
import android.net.Uri;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.graphics.Canvas;
import com.github.barteksc.pdfviewer.source.UriSource;
import com.github.barteksc.pdfviewer.source.DocumentSource;
import io.legere.pdfiumandroid.PdfDocument;

import io.legere.pdfiumandroid.util.Config;
import io.legere.pdfiumandroid.util.ConfigKt;
import io.legere.pdfiumandroid.util.AlreadyClosedBehavior;
import io.legere.pdfiumandroid.DefaultLogger;

import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.github.barteksc.pdfviewer.PdfRenderView;
import com.github.barteksc.pdfviewer.listener.OnPageChangeListener;
import com.github.barteksc.pdfviewer.listener.OnLoadCompleteListener;
import com.github.barteksc.pdfviewer.listener.OnErrorListener;
import com.github.barteksc.pdfviewer.listener.OnTapListener;
import com.github.barteksc.pdfviewer.listener.OnDrawListener;
import com.github.barteksc.pdfviewer.listener.OnPageScrollListener;
import com.github.barteksc.pdfviewer.util.FitPolicy;
import com.github.barteksc.pdfviewer.util.Constants;
import com.github.barteksc.pdfviewer.link.LinkHandler;
import com.github.barteksc.pdfviewer.model.LinkTapEvent;

import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.uimanager.UIManagerModule;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.RCTEventEmitter;


import static java.lang.String.format;


import com.google.gson.Gson;

import org.ammo.pdf.events.TopChangeEvent;

public class PdfView extends PdfRenderView implements OnPageChangeListener,OnLoadCompleteListener,OnErrorListener,OnTapListener,OnDrawListener,OnPageScrollListener, LinkHandler {
    private int page = 1;               // start from 1
    private boolean horizontal = false;
    private float scale = 1;
    private float minScale = 1;
    private float maxScale = 3;
    private String path;
    private int spacing = 10;
    private String password = "";
    private boolean enableAntialiasing = true;
    private boolean enableAnnotationRendering = true;
    private boolean enableDoubleTapZoom = true;

    private boolean enablePaging = false;
    private boolean autoSpacing = false;
    private boolean pageFling = false;
    private boolean pageSnap = false;
    private FitPolicy fitPolicy = FitPolicy.WIDTH;
    private boolean singlePage = false;
    private boolean scrollEnabled = true;
    private boolean enableRTL = false;
    private volatile int documentPageCount = 0;
    private boolean renderedRTL = false;
    private int renderedSinglePage = 0;

    private int documentPage(int displayIndex) {
        if (renderedSinglePage > 0) return renderedSinglePage;
        return renderedRTL ? documentPageCount - displayIndex : displayIndex + 1;
    }

    private int displayPage(int documentIndex) {
        return renderedRTL ? documentPageCount - 1 - documentIndex : documentIndex;
    }

    private float reportedScale = 1;
    private float maximumPageWidth = 0;
    private float maximumPageHeight = 0;

    // used to store the parameters for `super.onSizeChanged`
    private int oldW = 0;
    private int oldH = 0;

    public PdfView(Context context, AttributeSet set){
        super(context, set);
        ConfigKt.setPdfiumConfig(new Config(new DefaultLogger(), AlreadyClosedBehavior.IGNORE));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        // Fabric parents need not clip children; PDF tiles must stay in the reader viewport.
        canvas.save();
        canvas.clipRect(0, 0, getWidth(), getHeight());
        super.onDraw(canvas);
        canvas.restore();
    }

    @Override
    public void onPageChanged(int page, int numberOfPages) {
        // pdf lib page start from 0, convert it to our page (start from 1)
        if (enableRTL && !singlePage && !renderedRTL) return;
        page = documentPage(page);
        numberOfPages = documentPageCount;
        this.page = page;
        showLog(format("%s %s / %s", path, page, numberOfPages));

        WritableMap event = Arguments.createMap();
        event.putString("message", "pageChanged|"+page+"|"+numberOfPages);

        ThemedReactContext context = (ThemedReactContext) getContext();
        EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
        int surfaceId = UIManagerHelper.getSurfaceId(this);

        TopChangeEvent tce = new TopChangeEvent(surfaceId, getId(), event);

        if (dispatcher != null) {
            dispatcher.dispatchEvent(tce);
        }

//        ReactContext reactContext = (ReactContext)this.getContext();
//        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
//            this.getId(),
//            "topChange",
//            event
//         );
    }

    // In some cases Yoga (I think) will measure the view only along one axis first, resulting in
    // onSizeChanged being called with either w or h set to zero. This in turn starts the rendering
    // of the pdf under the hood with one dimension being set to zero and the follow-up call to
    // onSizeChanged with the correct dimensions doesn't have any effect on the already started process.
    // The offending class is DecodingAsyncTask, which tries to get width and height of the pdfView
    // in the constructor, and is created as soon as the measurement is complete, which in some cases
    // may be incomplete as described above.
    // By delaying calling super.onSizeChanged until the size in both dimensions is correct we are able
    // to prevent this from happening.
    //
    // I'm not sure whether the second condition is necessary, but without it, it would be impossible
    // to set the dimensions to zero after first measurement.
    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        if ((w > 0 && h > 0) || this.oldW > 0 || this.oldH > 0) {
            super.onSizeChanged(w, h, this.oldW, this.oldH);
            updatePageDimensions();
            removeCallbacks(revealHighlight);
            post(revealHighlight);
            this.oldW = w;
            this.oldH = h;
        }
    }

    @Override
    public void loadComplete(int numberOfPages) {
        protectRenderingLifetime();
        // The first decode learns the count on the worker thread, including protected/content URIs.
        if (enableRTL && !singlePage && !renderedRTL) {
            configurationChanged = true;
            post(this::drawPdf);
            return;
        }
        numberOfPages = documentPageCount;
        updatePageDimensions();
        removeCallbacks(revealHighlight);
        post(revealHighlight);
        SizeF pageSize = getPageSize(0);
        float width = pageSize.getWidth();
        float height = pageSize.getHeight();

        this.zoomTo(this.scale);
        WritableMap event = Arguments.createMap();

        //create a new json Object for the TableOfContents
        Gson gson = new Gson();
        event.putString("message", "loadComplete|"+numberOfPages+"|"+width+"|"+height+"|"+gson.toJson(this.getTableOfContents()));

        ThemedReactContext context = (ThemedReactContext) getContext();
        EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
        int surfaceId = UIManagerHelper.getSurfaceId(this);

        TopChangeEvent tce = new TopChangeEvent(surfaceId, getId(), event);

        if (dispatcher != null) {
            dispatcher.dispatchEvent(tce);
        }
        //        ReactContext reactContext = (ReactContext)this.getContext();
//        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
//            this.getId(),
//            "topChange",
//            event
//         );

        //Log.e("ReactNative", gson.toJson(this.getTableOfContents()));

    }

    @Override
    public void onError(Throwable t){
        WritableMap event = Arguments.createMap();
        if (t.getMessage().contains("Password required or incorrect password")) {
            event.putString("message", "error|Password required or incorrect password.");
        } else {
            event.putString("message", "error|"+t.getMessage());
        }

        ThemedReactContext context = (ThemedReactContext) getContext();
        EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
        int surfaceId = UIManagerHelper.getSurfaceId(this);

        TopChangeEvent tce = new TopChangeEvent(surfaceId, getId(), event);

        if (dispatcher != null) {
            dispatcher.dispatchEvent(tce);
        }

//        ReactContext reactContext = (ReactContext)this.getContext();
//        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
//            this.getId(),
//            "topChange",
//            event
//         );
    }

    @Override
    public void onPageScrolled(int page, float positionOffset){
        float x = getCurrentXOffset();
        float y = getCurrentYOffset();
        if (x != lastScrollX || y != lastScrollY) {
            lastScrollTime = android.os.SystemClock.uptimeMillis();
            lastScrollX = x;
            lastScrollY = y;
        }

        // maybe change by other instance, restore zoom setting
        Constants.Pinch.MINIMUM_ZOOM = this.minScale;
        Constants.Pinch.MAXIMUM_ZOOM = this.maxScale;

    }

    private Runnable pendingPageTap;
    private long lastScrollTime;
    private long rejectedTapDownTime = -1;
    private float lastScrollX;
    private float lastScrollY;


    @Override
    public boolean onTap(MotionEvent event) {
        if (event.getDownTime() == rejectedTapDownTime) return true;
        // AndroidPdfViewer confirms the single tap first, then handles links in
        // the same UI turn. Dispatch afterwards so its link handler can consume it.
        cancelPendingPageTap();
        final String message = "pageSingleTap|" + page + "|" + event.getX() + "|" + event.getY();
        pendingPageTap = () -> {
            pendingPageTap = null;
            WritableMap payload = Arguments.createMap();
            payload.putString("message", message);
            ThemedReactContext context = (ThemedReactContext) getContext();
            EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
            if (dispatcher != null) {
                dispatcher.dispatchEvent(new TopChangeEvent(UIManagerHelper.getSurfaceId(this), getId(), payload));
            }
        };
        post(pendingPageTap);
        return true;
    }

    @Override
    protected void onDetachedFromWindow() {
        cancelPendingPageTap();
        removeCallbacks(revealHighlight);
        super.onDetachedFromWindow();
    }

    private void cancelPendingPageTap() {
        if (pendingPageTap != null) {
            removeCallbacks(pendingPageTap);
            pendingPageTap = null;
        }
    }

    private org.json.JSONArray searchMatches = new org.json.JSONArray();
    private int activeMatch = -1;
    private org.json.JSONObject highlightInsets = new org.json.JSONObject();
    private final Runnable revealHighlight = this::revealActiveHighlight;
    private final android.graphics.Paint highlightPaint = new android.graphics.Paint();

    public void setHighlights(String value) {
        try {
            org.json.JSONObject payload = new org.json.JSONObject(value == null ? "{}" : value);
            org.json.JSONArray matches = payload.optJSONArray("matches");
            searchMatches = matches == null ? new org.json.JSONArray() : matches;
            activeMatch = payload.optInt("active", -1);
            org.json.JSONObject insets = payload.optJSONObject("insets");
            highlightInsets = insets == null ? new org.json.JSONObject() : insets;
        } catch (org.json.JSONException error) { searchMatches = new org.json.JSONArray(); }
        removeCallbacks(revealHighlight);
        post(revealHighlight);
        invalidate();
    }

    private void revealActiveHighlight() {
        org.json.JSONObject match = searchMatches.optJSONObject(activeMatch);
        if (match == null || getPageCount() == 0) return;
        org.json.JSONArray rects = match.optJSONArray("rects");
        org.json.JSONObject rect = rects == null ? null : rects.optJSONObject(0);
        if (rect == null) return;
        float x = (float) rect.optDouble("x", 0);
        float y = (float) rect.optDouble("y", 0);
        float width = (float) rect.optDouble("width", 0);
        float height = (float) rect.optDouble("height", 0);
        for (int turn = 0; turn < rotation / 90; turn++) {
            float nextX = 1 - y - height;
            y = x;
            x = nextX;
            float nextWidth = height;
            height = width;
            width = nextWidth;
        }
        float density = getResources().getDisplayMetrics().density;
        float top = Math.max(0, (float) highlightInsets.optDouble("top", 0)) * density;
        float bottom = Math.max(0, (float) highlightInsets.optDouble("bottom", 0)) * density;
        float left = Math.max(0, (float) highlightInsets.optDouble("left", 0)) * density;
        float right = Math.max(0, (float) highlightInsets.optDouble("right", 0)) * density;
        int target = displayPage(match.optInt("page", 1) - 1);
        if (target < 0 || target >= getPageCount()) return;
        android.util.SizeF size = getPageSize(target);
        // Keep the match near the available viewport centre. Top-aligning a short
        // page can move the viewport centre into its neighbour and report that page
        // back to JS, replacing the active match while navigating search results.
        top += Math.max(0, getHeight() - top - bottom - height * size.getHeight() * getZoom()) / 2;
        left += Math.max(0, getWidth() - left - right - width * size.getWidth() * getZoom()) / 2;
        revealPagePoint(target, x, y, top, left);
    }

    private void updatePageDimensions() {
        maximumPageWidth = 0;
        maximumPageHeight = 0;
        for (int index = 0; index < getPageCount(); index++) {
            SizeF size = getPageSize(index);
            maximumPageWidth = Math.max(maximumPageWidth, size.getWidth());
            maximumPageHeight = Math.max(maximumPageHeight, size.getHeight());
        }
    }

    private void drawHighlights(Canvas canvas, float width, float height, int page) {
        // AndroidPdfViewer offsets page bitmaps on the cross axis, but not draw listeners.
        canvas.save();
        if (isSwipeVertical()) canvas.translate((maximumPageWidth * getZoom() - width) / 2, 0);
        else canvas.translate(0, (maximumPageHeight * getZoom() - height) / 2);
        for (int i = 0; i < Math.min(searchMatches.length(), 256); i++) {
            org.json.JSONObject match = searchMatches.optJSONObject(i);
            if (match == null || match.optInt("page") != documentPage(page)) continue;
            org.json.JSONArray rects = match.optJSONArray("rects");
            if (rects == null) continue;
            highlightPaint.setColor(i == activeMatch ? 0x99ff8000 : 0x66ffe600);
            for (int j = 0; j < Math.min(rects.length(), 128); j++) {
                org.json.JSONObject rect = rects.optJSONObject(j);
                if (rect == null) continue;
                float x = (float) rect.optDouble("x", 0);
                float y = (float) rect.optDouble("y", 0);
                float w = (float) rect.optDouble("width", 0);
                float h = (float) rect.optDouble("height", 0);
                for (int turn = 0; turn < rotation / 90; turn++) {
                    float nextX = 1 - y - h;
                    y = x;
                    x = nextX;
                    float nextWidth = h;
                    h = w;
                    w = nextWidth;
                }
                canvas.drawRect(x * width, y * height, (x + w) * width, (y + h) * height, highlightPaint);
            }
        }
        canvas.restore();
    }

    @Override
    public void onLayerDrawn(Canvas canvas, float pageWidth, float pageHeight, int displayedPage){
        float zoom = getZoom();
        if (reportedScale != zoom) {
            reportedScale = zoom;
            // maybe change by other instance, restore zoom setting
            Constants.Pinch.MINIMUM_ZOOM = this.minScale;
            Constants.Pinch.MAXIMUM_ZOOM = this.maxScale;

            WritableMap event = Arguments.createMap();
            event.putString("message", "scaleChanged|"+zoom);
            ThemedReactContext context = (ThemedReactContext) getContext();
            EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
            int surfaceId = UIManagerHelper.getSurfaceId(this);

            TopChangeEvent tce = new TopChangeEvent(surfaceId, getId(), event);

            if (dispatcher != null) {
                dispatcher.dispatchEvent(tce);
            }
//            ReactContext reactContext = (ReactContext)this.getContext();
//            reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
//                this.getId(),
//                "topChange",
//                event
//             );
        }

    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (this.isRecycled())
            this.drawPdf();
    }

    private int rotation = 0;

    public void setRotationDegrees(int rotation) {
        if (this.rotation == rotation) return;
        this.rotation = rotation;
        configurationChanged = true;
    }

    private boolean configurationChanged = true;

    public void drawPdf() {
        if (!configurationChanged && !isRecycled()) return;
        configurationChanged = false;
        showLog(format("drawPdf path:%s %s", this.path, this.page));

        if (this.path != null){

            // set scale
            this.setMinZoom(this.minScale);
            this.setMaxZoom(this.maxScale);
            this.setMidZoom((this.maxScale+this.minScale)/2);
            Constants.Pinch.MINIMUM_ZOOM = this.minScale;
            Constants.Pinch.MAXIMUM_ZOOM = this.maxScale;

            Configurator configurator;

            DocumentSource source = rotation == 0
                ? new UriSource(getURI(this.path))
                : new RotatedDocumentSource(getURI(this.path), rotation);
            configurator = this.fromSource((context, core, documentPassword) -> {
                PdfDocument document = source.createDocument(context, core, documentPassword);
                documentPageCount = document.getPageCount();
                return document;
            });
            renderedRTL = enableRTL && !singlePage && documentPageCount > 0;
            renderedSinglePage = singlePage ? this.page : 0;

            configurator.defaultPage(singlePage ? 0 : displayPage(this.page - 1))
                .swipeHorizontal(this.horizontal)
                .onPageChange(this)
                .onLoad(this)
                .onRender((pages) -> {
                    WritableMap payload = Arguments.createMap();
                    payload.putString("message", "renderReady");
                    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ReactContext) getContext(), getId());
                    if (dispatcher != null) dispatcher.dispatchEvent(new TopChangeEvent(UIManagerHelper.getSurfaceId(this), getId(), payload));
                })
                .onError(this)
                .onDraw(this)
                .onDrawAll(this::drawHighlights)
                .onPageScroll(this)
                .spacing(this.spacing)
                .password(this.password)
                .enableAntialiasing(this.enableAntialiasing)
                .pageFitPolicy(this.fitPolicy)
                .pageSnap(this.pageSnap)
                .autoSpacing(this.autoSpacing)
                .pageFling(this.pageFling)
                .enableSwipe(!this.singlePage && this.scrollEnabled)
                .enableDoubletap(!this.singlePage && this.enableDoubleTapZoom)
                .enableAnnotationRendering(this.enableAnnotationRendering)
                .linkHandler(this)
            ;

            if (renderedRTL) {
                int[] reversedPages = new int[documentPageCount];
                for (int i = 0; i < documentPageCount; i++) {
                    reversedPages[i] = documentPageCount - 1 - i;
                }
                configurator.pages(reversedPages);
            }

            if (this.singlePage) {
                configurator.pages(this.page-1);
            } else {
                configurator.onTap(this);
            }

            configurator.load();
        }
    }

    public void setEnableDoubleTapZoom(boolean enableDoubleTapZoom) {
        configurationChanged = true;
        this.enableDoubleTapZoom = enableDoubleTapZoom;
    }

    public void setPath(String path) {
        configurationChanged = true;
        if (!java.util.Objects.equals(this.path, path)) documentPageCount = 0;
        this.path = path;
    }

    // page start from 1
    public void setPage(int page) {
        this.page = documentPageCount > 0 ? Math.min(Math.max(page, 1), documentPageCount) : Math.max(page, 1);
        if (singlePage) configurationChanged = true;
        else this.handlePage(this.page - 1);
    }

    public void setEnableRTL(boolean enableRTL) {
        configurationChanged = true;
        this.enableRTL = enableRTL;
    }

    public void setScale(float scale) {
        configurationChanged = true;
        this.scale = scale;
    }

    public void setMinScale(float minScale) {
        configurationChanged = true;
        this.minScale = minScale;
    }

    public void setMaxScale(float maxScale) {
        configurationChanged = true;
        this.maxScale = maxScale;
    }

    public void setHorizontal(boolean horizontal) {
        configurationChanged = true;
        this.horizontal = horizontal;
    }

    public void setScrollEnabled(boolean scrollEnabled) {
        configurationChanged = true;
        this.scrollEnabled = scrollEnabled;
    }

    public void setSpacing(int spacing) {
        configurationChanged = true;
        this.spacing = spacing;
    }

    public void setPassword(String password) {
        configurationChanged = true;
        this.password = password;
    }

    public void setEnableAntialiasing(boolean enableAntialiasing) {
        configurationChanged = true;
        this.enableAntialiasing = enableAntialiasing;
    }

    public void setEnableAnnotationRendering(boolean enableAnnotationRendering) {
        configurationChanged = true;
        this.enableAnnotationRendering = enableAnnotationRendering;
    }

    public void setEnablePaging(boolean enablePaging) {
        configurationChanged = true;
        this.enablePaging = enablePaging;
        if (this.enablePaging) {
            this.autoSpacing = true;
            this.pageFling = true;
            this.pageSnap = true;
        } else {
            this.autoSpacing = false;
            this.pageFling = false;
            this.pageSnap = false;
        }
    }

    public void setFitPolicy(int fitPolicy) {
        configurationChanged = true;
        switch(fitPolicy){
            case 0:
                this.fitPolicy = FitPolicy.WIDTH;
                break;
            case 1:
                this.fitPolicy = FitPolicy.HEIGHT;
                break;
            case 2:
            default:
            {
                this.fitPolicy = FitPolicy.BOTH;
                break;
            }
        }

    }

    public void setSinglePage(boolean singlePage) {
        configurationChanged = true;
        this.singlePage = singlePage;
    }

    /**
     * @see https://github.com/barteksc/AndroidPdfViewer/blob/master/android-pdf-viewer/src/main/java/com/github/barteksc/pdfviewer/link/DefaultLinkHandler.java
     */
    public void handleLinkEvent(LinkTapEvent event) {
        cancelPendingPageTap();
        String uri = event.getLink().getUri();
        Integer page = event.getLink().getDestPageIdx();
        if (uri != null && !uri.isEmpty()) {
            handleUri(uri);
        } else if (page != null) {
            handlePage(page);
        }
    }

    /**
     * @see https://github.com/barteksc/AndroidPdfViewer/blob/master/android-pdf-viewer/src/main/java/com/github/barteksc/pdfviewer/link/DefaultLinkHandler.java
     */
    private void handleUri(String uri) {
        WritableMap event = Arguments.createMap();
        event.putString("message", "linkPressed|"+uri);

        ThemedReactContext context = (ThemedReactContext) getContext();
        EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
        int surfaceId = UIManagerHelper.getSurfaceId(this);

        TopChangeEvent tce = new TopChangeEvent(surfaceId, getId(), event);

        if (dispatcher != null) {
            dispatcher.dispatchEvent(tce);
        }

//        ReactContext reactContext = (ReactContext)this.getContext();
//        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
//            this.getId(),
//            "topChange",
//            event
//        );
    }

    /**
     * @see https://github.com/barteksc/AndroidPdfViewer/blob/master/android-pdf-viewer/src/main/java/com/github/barteksc/pdfviewer/link/DefaultLinkHandler.java
     */
    private void handlePage(int page) {
        this.jumpTo(displayPage(page));
    }

    private void showLog(final String str) {
        Log.d("PdfView", str);
    }

    private Uri getURI(final String uri) {
        Uri parsed = Uri.parse(uri);

        if (parsed.getScheme() == null || parsed.getScheme().isEmpty()) {
          return Uri.fromFile(new File(uri));
        }
        return parsed;
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
            // Capture before AndroidPdfViewer.onDown stops its fling animation.
            if (event.getEventTime() - lastScrollTime < 150) rejectedTapDownTime = event.getDownTime();
        }
        // Keep AndroidPdfViewer's gesture listener installed when leaving single-page mode.
        return singlePage || super.dispatchTouchEvent(event);
    }
}
