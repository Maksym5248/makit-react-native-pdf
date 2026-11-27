package com.pdfreaderexample;

import android.content.Intent;
import android.graphics.Rect;
import android.os.SystemClock;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import static org.junit.Assert.*;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;

/** Device-only regression tests. No external services and no application-data reset. */
public class ReaderTests {
    private AccessibilityNodeInfo find(AccessibilityNodeInfo node, String text) {
        if (node == null) return null;
        if (text.contentEquals(node.getText() == null ? "" : node.getText()) ||
            text.contentEquals(node.getContentDescription() == null ? "" : node.getContentDescription())) return node;
        for (int index = 0; index < node.getChildCount(); index++) {
            AccessibilityNodeInfo found = find(node.getChild(index), text);
            if (found != null) return found;
        }
        return null;
    }

    private AccessibilityNodeInfo awaitText(String text, long timeout) {
        long deadline = SystemClock.uptimeMillis() + timeout;
        while (SystemClock.uptimeMillis() < deadline) {
            AccessibilityNodeInfo found = find(InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow(), text);
            if (found != null) return found;
            SystemClock.sleep(100);
        }
        fail("Missing UI text: " + text);
        return null;
    }

    private void tap(String text) {
        long deadline = SystemClock.uptimeMillis() + 15000;
        while (SystemClock.uptimeMillis() < deadline) {
            AccessibilityNodeInfo node = find(InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow(), text);
            while (node != null && !node.isClickable()) node = node.getParent();
            if (node != null && node.isEnabled() && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return;
            SystemClock.sleep(100);
        }
        fail("Button did not become actionable: " + text);
    }

    private void launch() {
        Intent intent = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageManager()
            .getLaunchIntentForPackage("com.pdfreaderexample");
        assertNotNull(intent);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        InstrumentationRegistry.getInstrumentation().startActivitySync(intent);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        awaitText("RUN API CHECKS", 30000);
    }

    @Test
    public void testPageTapControls() throws Exception {
        launch();
        tap("ТЕСТОВИЙ PDF");
        awaitText("1 / 3", 15000);
        Rect bounds = new Rect();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow().getBoundsInScreen(bounds);
        float x = bounds.width() * 0.4f;
        float y = bounds.height() * 0.4f;
        long time = SystemClock.uptimeMillis();
        inject(time, MotionEvent.ACTION_DOWN, x, y, 0, 1);
        inject(time, MotionEvent.ACTION_UP, x, y, 0, 1);
        SystemClock.sleep(700);
        screenshot("pdf-tap-hidden.png");
        AccessibilityNodeInfo hidden = find(InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow(), "ПОШУК");
        assertTrue(hidden == null || !hidden.isVisibleToUser());
        time = SystemClock.uptimeMillis();
        inject(time, MotionEvent.ACTION_DOWN, x, y, 0, 1);
        inject(time, MotionEvent.ACTION_UP, x, y, 0, 1);
        SystemClock.sleep(700);
        assertTrue(awaitText("ПОШУК", 5000).isVisibleToUser());
        awaitText("1 / 3", 5000);
        screenshot("pdf-tap-restored.png");
    }

    @Test
    public void testStoppingScrollDoesNotToggleTools() throws Exception {
        launch();
        tap("ТЕСТОВИЙ PDF");
        awaitText("1 / 3", 15000);
        SystemClock.sleep(500);
        Rect bounds = new Rect();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow().getBoundsInScreen(bounds);
        float x = bounds.width() * 0.4f;
        float startY = bounds.height() * 0.65f;
        float endY = bounds.height() * 0.35f;
        long time = SystemClock.uptimeMillis();
        inject(time, MotionEvent.ACTION_DOWN, x, startY, 0, 1);
        for (int step = 1; step <= 8; step++) {
            SystemClock.sleep(10);
            inject(time, MotionEvent.ACTION_MOVE, x, startY + (endY - startY) * step / 8, 0, 1);
        }
        inject(time, MotionEvent.ACTION_UP, x, endY, 0, 1);
        SystemClock.sleep(30);
        time = SystemClock.uptimeMillis();
        inject(time, MotionEvent.ACTION_DOWN, x, endY, 0, 1);
        inject(time, MotionEvent.ACTION_UP, x, endY, 0, 1);
        SystemClock.sleep(700);
        assertTrue(awaitText("ПОШУК", 5000).isVisibleToUser());
        screenshot("pdf-stop-scroll-tools.png");
    }

    @Test
    public void testNativeContracts() throws Exception {
        launch();
        tap("RUN API CHECKS");
        awaitText("PASS 15/15", 60000);
        tap("RUN RENDERER CHECKS");
        awaitText("PASS 8/8: ", 90000);
        screenshot("pdf-renderer-e2e.png");
    }

    private AccessibilityNodeInfo button(String text) {
        AccessibilityNodeInfo node = awaitText(text, 10000);
        while (node != null && !"android.widget.Button".contentEquals(node.getClassName())) node = node.getParent();
        assertNotNull(node);
        return node;
    }

    @Test
    public void testSearchThumbnailsAndReadingModes() throws Exception {
        launch();
        assertFalse(button("ПОШУК").isEnabled());
        tap("ТЕСТОВИЙ PDF");
        awaitText("1 / 3", 15000);
        assertTrue(button("ПОШУК").isEnabled());
        screenshot("pdf-enabled-buttons.png");
        tap("ПОШУК");
        AccessibilityNodeInfo input = awaitText("Пошук у PDF", 10000);
        android.os.Bundle arguments = new android.os.Bundle();
        arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "alpha");
        assertTrue(input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments));
        tap("ЗБІГ →");
        awaitText("1/6", 15000);
        tap("ЗБІГ →");
        awaitText("2/6", 10000);
        tap("← ЗБІГ");
        awaitText("1/6", 10000);
        tap("СХОВАТИ");
        screenshot("pdf-search-e2e.png");
        tap("СТОРІНКИ");
        tap("Page 3");
        awaitText("3 / 3", 10000);
        tap("ВИГЛЯД");
        tap("Horizontal");
        tap("Paging");
        tap("ПОВОРОТ 0°");
        awaitText("ПОВОРОТ 90°", 10000);
        tap("ЗА ШИРИНОЮ");
        awaitText("УСЯ СТОРІНКА", 10000);
        awaitText("3 / 3", 10000);
        tap("СХОВАТИ");
        screenshot("pdf-rotated-e2e.png");
        tap("ФАЙЛ");
        tap("ЗАКРИТИ");
        awaitText("Документ закрито", 10000);
        assertFalse(button("ПОШУК").isEnabled());
        tap("ТЕСТОВИЙ PDF");
        awaitText("1 / 3", 15000);
    }

    @Test
    public void testPreparedBook() throws Exception {
        String path = InstrumentationRegistry.getArguments().getString("preparedPdfPath");
        org.junit.Assume.assumeTrue("Explicit local prepared PDF required", path != null && !path.isEmpty());
        launch();
        AccessibilityNodeInfo localFile = awaitText("Local PDF path", 10000);
        android.os.Bundle arguments = new android.os.Bundle();
        arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, path);
        assertTrue(localFile.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments));
        tap("ВІДКРИТИ ЛОКАЛЬНИЙ URI");
        awaitText("1 / 6", 15000);
        tap("ПОШУК");
        AccessibilityNodeInfo input = awaitText("Пошук у PDF", 10000);
        arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "Synthetic");
        assertTrue(input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments));
        tap("ЗБІГ →");
        awaitText("1/5", 15000);
        tap("СХОВАТИ");
        awaitText("1 / 6", 10000);
        screenshot("prepared-page-1.png");
        tap("ПОШУК");
        for (int match = 2; match <= 5; match++) {
            tap("ЗБІГ →");
            awaitText(match + "/5", 10000);
            tap("СХОВАТИ");
            SystemClock.sleep(1000);
            screenshot("prepared-page-" + match + ".png");
            awaitText(match + " / 6", 10000);
            tap("ПОШУК");
        }
        tap("СХОВАТИ");
        screenshot("prepared-intrinsic-rotation.png");
        tap("ВИГЛЯД");
        tap("+");
        awaitText("120%", 10000);
        tap("ПОВОРОТ 0°");
        awaitText("ПОВОРОТ 90°", 10000);
        awaitText("5 / 6", 10000);
        tap("СХОВАТИ");
        SystemClock.sleep(700);
        screenshot("prepared-zoom-rotation.png");
        tap("ПОШУК");
        input = awaitText("Пошук у PDF", 10000);
        arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "no-such-text");
        assertTrue(input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments));
        awaitText("0/0", 10000);
        tap("СХОВАТИ");
        SystemClock.sleep(700);
        screenshot("prepared-no-match.png");
    }

    private void screenshot(String name) throws java.io.IOException {
        android.graphics.Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        java.io.File output = new java.io.File(InstrumentationRegistry.getInstrumentation().getTargetContext().getFilesDir(), name);
        try (java.io.FileOutputStream stream = new java.io.FileOutputStream(output)) {
            assertTrue(bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, stream));
        } finally {
            bitmap.recycle();
        }
    }

    private void inject(long downTime, int action, float centerX, float centerY, float distance, int count) {
        MotionEvent.PointerProperties[] properties = new MotionEvent.PointerProperties[count];
        MotionEvent.PointerCoords[] points = new MotionEvent.PointerCoords[count];
        for (int index = 0; index < count; index++) {
            properties[index] = new MotionEvent.PointerProperties();
            properties[index].id = index;
            properties[index].toolType = MotionEvent.TOOL_TYPE_FINGER;
            points[index] = new MotionEvent.PointerCoords();
            points[index].x = centerX + (index == 0 ? -distance : distance);
            points[index].y = centerY;
            points[index].pressure = 1;
            points[index].size = 1;
        }
        MotionEvent event = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, count,
            properties, points, 0, 0, 1, 1, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0);
        assertTrue(InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(event, true));
        event.recycle();
    }

    private int zoomPercent(AccessibilityNodeInfo node) {
        if (node == null) return 0;
        String text = node.getText() == null ? "" : node.getText().toString();
        if (text.matches("[0-9]+%")) return Integer.parseInt(text.replace("%", ""));
        for (int index = 0; index < node.getChildCount(); index++) {
            int zoom = zoomPercent(node.getChild(index));
            if (zoom > 0) return zoom;
        }
        return 0;
    }

    @Test
    public void testRealTwoFingerPinch() throws Exception {
        launch();
        tap("ТЕСТОВИЙ PDF");
        awaitText("1 / 3", 15000);
        Rect bounds = new Rect();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow().getBoundsInScreen(bounds);
        float x = bounds.exactCenterX();
        float y = bounds.exactCenterY();
        float start = bounds.width() * 0.18f;
        long time = SystemClock.uptimeMillis();
        inject(time, MotionEvent.ACTION_DOWN, x, y, start, 1);
        inject(time, MotionEvent.ACTION_POINTER_DOWN | (1 << MotionEvent.ACTION_POINTER_INDEX_SHIFT), x, y, start, 2);
        for (int step = 1; step <= 20; step++) {
            SystemClock.sleep(20);
            inject(time, MotionEvent.ACTION_MOVE, x, y, start * (1 + step / 20f), 2);
        }
        inject(time, MotionEvent.ACTION_POINTER_UP | (1 << MotionEvent.ACTION_POINTER_INDEX_SHIFT), x, y, start * 2, 2);
        inject(time, MotionEvent.ACTION_UP, x, y, start * 2, 1);
        tap("ВИГЛЯД");
        awaitText("Вигляд і дані", 10000);
        int zoom = 0;
        long deadline = SystemClock.uptimeMillis() + 5000;
        while (SystemClock.uptimeMillis() < deadline) {
            zoom = zoomPercent(InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow());
            if (zoom > 110) break;
            SystemClock.sleep(100);
        }
        assertTrue("Pinch zoom callback: " + zoom + ", bounds: " + bounds, zoom > 110 && zoom <= 300);
        tap("СХОВАТИ");
        tap("НАСТУПНА");
        awaitText("2 / 3", 10000);
        tap("ВИГЛЯД");
        awaitText("2 / 3", 10000);
        screenshot("pdf-zoom-e2e.png");
    }
}
