package org.ammo.pdf.events;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.Event;

public class TopChangeEvent extends Event<TopChangeEvent> {
    private WritableMap eventData;

    public TopChangeEvent(int surfaceId, int viewTag, WritableMap data) {
        super(surfaceId, viewTag);
        eventData = data;
    }

    @Override
    public String getEventName() {
        return "topChange";
    }

    // One channel carries load, page, scale and errors. Coalescing can discard
    // a load/error when a page event arrives in the same frame.
    @Override
    public boolean canCoalesce() {
        return false;
    }

    @Nullable
    @Override
    protected WritableMap getEventData() {
        return eventData;
    }
}
