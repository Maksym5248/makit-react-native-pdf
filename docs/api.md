# API reference

## Reader and navigation

```tsx
import { useRef } from 'react';
import { PdfReader, type IPdfReaderRef } from '@makit-kit/react-native-pdf';

const reader = useRef<IPdfReaderRef>(null);

<PdfReader
    ref={reader}
    sourceUri={localFileUri}
    page={savedPage}
    scale={1}
    onPageChanged={(page, total) => saveProgress(page)}
    onLoadComplete={(total, uri, size) => setLoading(false)}
    onError={error => showError(error)}
    style={{ flex: 1 }}
/>;

reader.current?.setPage(12);
```

Page numbers start at **1**. `page` sets the initial page and responds to value
changes. `setPage` can navigate to the same page repeatedly. A command issued
before loading completes is applied when the document opens. Invalid numbers
are normalized; once loaded, navigation is clamped to the document's page count.

The default scale range is 0.6–3; override it with `minScale` and `maxScale`.
Native supports pinch and double tap. `scrollEnabled={false}` disables scrolling;
`singlePage` displays only the selected page. Use `PdfThumbnails` for a thumbnail
strip instead of mounting separate reader instances. Annotation rendering is
enabled by default.

The application owns bookmarks, outlines shown in its UI, progress, history and
persistence. Store the page reported by `onPageChanged`; the package does not
persist the intra-page scroll offset or zoom level.

## Local sources

- Native accepts an absolute file path or `file:///...` URI. Android also accepts
  `content://...` with access already granted by the caller.
- Web accepts a `blob:` URL created with `URL.createObjectURL(fileOrBlob)`. The
  application owns the Blob and any IndexedDB cache. Keep the URL alive while
  the reader uses it.
- HTTP(S), data URLs and relative paths are rejected through `onError`. There is
  no network fallback.
- Missing, damaged or password-protected document errors use `onError`.
- Changing the URI creates a new document. Events from an unmounted JavaScript
  component are ignored.

The PDF.js worker is bundled through `new URL(..., import.meta.url)`. Ship
React-PDF 9.2.1 with its matching PDF.js version; no CDN is used. The included
`patches/react-pdf+9.2.1.patch` fixes text-layer cleanup: cancelled tasks cannot
invoke success/error callbacks, while errors from active tasks remain visible.
Apply both supplied Web patches with:

```sh
node node_modules/@makit-kit/react-native-pdf/scripts/apply-web-patches.cjs
```

The script checks exact versions and accepts repeated application. For a fully
offline Web cold start, the application must make its JavaScript and worker
assets available. The package does not install a service worker.

## Search and highlights

```ts
const document = await openPdfSearch(localUri, password);
try {
    const result = await document.searchPage(1, 'alpha');
    // Pass result.matches to PdfReader.highlights and the selected match index
    // to activeMatch.
} finally {
    document.close();
}
```

The native API is a React Native Codegen TurboModule exposed through JSI.
PDFKit/PDFium operations run on a dedicated serial queue with a document separate
from the renderer. Web extracts text through a local PDF.js worker, searches in
a separate worker and highlights precise text-layer span ranges. iOS uses
PDFSelection; Android uses PDFium geometry and a canvas overlay. Highlights do
not modify the PDF file.

Search uses one-based page numbers and is case-insensitive by default. Limits:
512 query characters, 256 matches per page and 128 rectangles per match.
`truncated` reports the match limit. `hasText` distinguishes a missing text layer
from an ordinary search with no matches. OCR is not performed.

`close()` is idempotent; pending results are rejected after closing. The caller
requests pages in batches and stops requesting new pages when cancelled. A
native operation already running on a page completes on its queue without
blocking the UI synchronously.

`start` and `length` refer to the current platform's extracted text. Do not store
them as portable coordinates or mix offsets from different PDF engines. Web
uses text ranges and returns empty `rects`. Native rectangles belong to the
current renderer; iOS uses selection ranges to account for rotation.

## Reading modes

- `enablePaging={false}` enables continuous scrolling; `true` enables page-by-page
  navigation (CSS scroll snap on Web).
- `horizontal` selects the scroll direction independently of page rotation.
- `rotation={0 | 90 | 180 | 270}` adds clockwise rotation to the rotation stored in
  the PDF. The file on disk is unchanged.
- `fitPolicy={0}` fits width, `1` fits height and `2` fits the whole page. `scale`
  multiplies that fit; use `scale={1}` to return to the fitted size.
- `singlePage` displays only the selected page and is independent of paging.

iOS uses PDFKit rotation. Android uses a small JNI binding to the public
`FPDFPage_SetRotation` API from PDFiumAndroid 1.0.35 under its global lock. Changing
rotation reopens the renderer and recalculates page geometry; search and
thumbnails retain their separate session. Measure this transition on target
devices for large documents. Web rotates the canvas, text and annotation layers
together through PDF.js. Android applies the same rotation to match coordinates.

Native also supports RTL, scroll indicators, antialiasing, double tap, passwords,
the outline in the fourth `onLoadComplete` argument and scale/tap/link callbacks.
Web supports reversed page order, double-click zoom, outlines and callbacks.
Custom touch pinch and independent scroll-indicator styling are not claimed.
See the [capability matrix](parity.md).

## Metadata and thumbnails

```tsx
const document = await openPdfSearch(localUri, password);
const count = document.pages; // Available without PdfReader.
const info = await document.getPageInfo(3);
const text = await document.getPageText(3); // One page; empty for a scan without text.
// width/height: PDF points before intrinsic rotation; rotation: stored rotation.
// hasText: the current page's text layer, not the entire document; no OCR.
const image = await document.renderThumbnail(3, 160);
// { uri: 'data:image/png;base64,...', width, height }; dimensions are pixels.

<PdfThumbnails
    document={document}
    page={currentPage}
    onPageSelected={page => reader.current?.setPage(page)}
    onError={showError}
/>;
// After all consumers have unmounted:
document.close();
```

Search, metadata and thumbnails reuse **the same session**. Metadata is read on
demand for each page; the entire document is not indexed in advance. Dimensions
use the crop box, falling back to the media box. Thumbnails include intrinsic
file rotation; additional viewing rotation does not change them.

`renderThumbnail` caps the longest side at 512 pixels (default: 160).
`PdfThumbnails` virtualizes its strip, sequentially renders only the visible
window at 160 pixels and retains at most 2 MiB of encoded images in its JavaScript
cache. `ThumbnailLoader` also supports taller grids without truncating the list
of visible pages.

This is not a bound on the PDF engine's total memory or the system image cache.
Native bitmaps and temporary Web canvases are released after encoding; no PNG
files are written to disk. Scrolling replaces the queue; unmounting clears it.
An operation already running may finish, but its stale result is ignored. Custom
API consumers must bound their own concurrency and image retention.

### Custom thumbnail interfaces

`ThumbnailLoader` is exported for applications with their own strip or grid.
Create it with an open `IPdfSearchDocument` and an image callback, pass visible
page numbers to `setPages(pages)` and call `dispose()` when the UI closes. The
caller owns the document; the loader does not close it. It uses the same bounded
cache and queue as `PdfThumbnails`.

## Single taps and application panels

`onPageSingleTap(page, x, y)` reports a confirmed single tap on the PDF. The
package recognizes the gesture; the application controls panel visibility.
Double-tap zoom, scrolling, pinch, long press, text selection and PDF links
should not toggle toolbars. Web waits for the click sequence to finish before
calling back; native uses platform gesture confirmation.

Overlay panels on a stable renderer area: changing its height affects
fit-height and fit-page. Do not change `key` or `sourceUri` to hide UI. The example
demonstrates toggling panels without closing the PDF. Applications must also
provide keyboard and screen-reader alternatives.

## Loading indicator

`renderLoading?: () => ReactNode` replaces the default ActivityIndicator with a
custom component. The package shows an overlay from opening a local source until
the renderer is ready (the initial page's canvas on Web). It removes the overlay
on error and shows it again when the source changes.

```tsx
<PdfReader sourceUri={localFileUri} renderLoading={() => <MyLoader />} />
```

Network downloads and their progress indicators belong to the application. The
standalone example demonstrates a custom local-opening indicator.

## Search result viewport insets

`highlightContentInsets={{ top: headerHeight, bottom: toolbarHeight }}` controls
scrolling to the active search result. Values are logical pixels; omitted sides
default to zero. It does not add padding or resize the PDF. Navigation is clamped
at document boundaries, so a result at the very start or end can still be covered
by an overlay. Pass measured overlay sizes and update them when panels change.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run test:web-build
npm run typecheck:example
npm run build:web --workspace pdf-reader-example
```

Unit/component tests cover URI validation, navigation, lifecycle, search,
Unicode, multiline matches, limits, HTML escaping and thumbnail queue/cache
behavior. Native runtime and Web are verified separately; passing Web checks does
not certify native behavior. See the [capability matrix](parity.md). Text offsets
remain engine-specific, and the package does not perform OCR.
