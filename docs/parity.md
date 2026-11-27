# Reader capability matrix

The API is compared with react-native-pdf 7.0.4. File downloads, caching,
bookmarks, persistence and application navigation belong to the consumer.
This matrix describes the inherited contract and regression scenarios;
it is not fresh native certification of the standalone/Expo build.

| Capability | iOS / Android | Web | Evidence / boundary |
| --- | --- | --- | --- |
| Local file | absolute/file URI; Android content URI with caller permission | caller-owned Blob URL | API checks + two large local files; content-provider permissions remain caller-owned |
| Initial page / setPage / page callback | supported, document numbering from 1 | supported | runtime renderer checks; commands before load covered by unit tests |
| Continuous / horizontal / paging / single page | supported | supported, CSS snap | native UI + renderer tests; browser flow |
| RTL | document-order navigation | reverse page order | runtime renderer checks on all three platforms |
| scale/minScale/maxScale | supported | supported | clamp tests; native pinch; browser scale control |
| Pinch / double tap | supported; single page disables interaction | double click zoom; browser text selection; no custom touch pinch | iOS/Android real two-pointer tests; iOS double tap |
| fitPolicy, spacing, viewport clipping | supported | supported | mixed page sizes, navigation, rotation checks |
| Scroll lock | supported | overflow disabled | public prop forwarding + web layout; gestures remain separate from scroll lock |
| Scroll indicators | native props preserved | browser-controlled indicators | Web does not promise independent per-axis indicator styling |
| Antialiasing | Android renderer option; PDFKit system rendering | browser/PDF.js rendering | platform-specific upstream option |
| Password and retry | supported | supported, no prompt or retry loop | API/renderer checks; password change recreates web worker |
| Annotation rendering | existing PDF annotations; toggle | PDF.js annotation layer; toggle | native implementation + prop regression tests; not annotation editing |
| Load/page/error/scale/tap/link callbacks | supported | supported | event-contract tests; runtime page/load/error/scale; web external links route to callback |
| Embedded outline | load callback, zero-based pageIdx | nested outline resolved through PDF.js | contract tests; no raw native pointer in portable API |
| Rotation | additional 0/90/180/270 over intrinsic rotation | same | mixed-size rotated fixture; native/browser UI checks |
| Search + active/result highlights | native TurboModule/JSI, asynchronous worker queue | local PDF.js/search workers | 15 API checks, Unicode/multiline, visible highlights |
| Metadata and text-layer detection | lazy per-page, PDF points | same | API checks include actual image-only PDF |
| Thumbnails | shared search document; virtualized bounded JS cache | same | API/cache tests + thumbnail-to-page UI |
| Saved position | caller initializes `page` and stores callback value | same | no persistence side effect; intra-page offset not stored |

## Deliberately outside the renderer

The old `source` download fields (`headers`, `method`, `cache`, `cacheFileName`,
`expiration`), `trustAllCerts`, remote URL/asset downloading, `onLoadProgress`,
`renderActivityIndicator` and `progressContainerStyle` describe fetching and its
UI. They are not exposed. The caller downloads/resolves an asset first, passes
its local URI and owns its loading/error presentation. A local renderer reports
completion/error; it cannot truthfully report network progress.

`TableContent.mNativePtr` is not portable or safe to expose across engines;
`IPdfOutline` contains title, zero-based page index and children. Page and search
indices otherwise start at 1. Search offsets/geometry are engine-local, not a
cross-platform persistence format. No OCR, PDF editing, form persistence,
annotation authoring or document synchronization is claimed.

## Validation boundaries

The original implementation was exercised with React Native 0.83.1 New Architecture,
React 19.2, iOS simulators and an Android arm64 emulator. The standalone and Expo
examples use React Native 0.83.10. New build/runtime results must be recorded separately;
previous simulator evidence does not verify this copy or Expo.

Build/codegen checks do not certify every OS, ABI, browser or React Native version.
Peer ranges express the API baseline, not a tested compatibility matrix for all versions.
Real-device release FPS, thermal behavior, screen-reader usability and absence of all
memory leaks are not implied by simulator or mock tests.
