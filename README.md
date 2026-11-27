# Makit · React Native PDF

Let people read a downloaded manual, find a phrase and jump to the relevant page inside your React Native app. Pass a local file to the native reader on iOS or Android, or a Blob URL on Web. Rendering and text search run on the device.

[Try the Web playground](https://maksym5248.github.io/makit-react-native-pdf/demo/) · [API reference](docs/api.md) · [Platform support](docs/parity.md)

## Inside the reader

![Three Android screenshots showing a PDF page, page thumbnails and a highlighted search result](https://raw.githubusercontent.com/Maksym5248/makit-react-native-pdf/6807d84b8728d40edf1ecae1f0bd6bb2c8fb1306/site/screenshots/android-reader.jpg)

*Captured in the Expo development build on an Android emulator.*

- **Read a local document.** The demo opens *The Night Sky*, an illustrated three-page guide. Tap the page to hide the controls, or choose **Open PDF** to read your own file.
- **Jump by thumbnail.** Open **Pages** and tap a preview to go straight to that page.
- **Find a passage.** Open **Find** and type `stars`. The guide contains three matches. **Next match** takes you to the next occurrence and highlights it in context. Search uses the existing PDF text layer.

The example app supplies the toolbar and panels. Use the reader, search API and thumbnail component to build controls that fit your app. You can also choose continuous or paged reading, set zoom and rotation, and save the current page from the page-change callback. Your app controls file access, downloads and saved positions.

## Install

The library targets React 19 and React Native 0.83+ with the New Architecture. The Expo example uses SDK 55 and a development build.

```sh
npm install @makit-kit/react-native-pdf
```

For bare iOS projects, run `cd ios && bundle exec pod install`. For Expo, follow the [Expo setup](docs/expo.md). Web also requires the peers and worker setup below.

## Quick start

```tsx
import { PdfReader } from '@makit-kit/react-native-pdf';

<PdfReader
  sourceUri={localFileUri}
  style={{ flex: 1 }}
  onPageChanged={(page, total) => console.log(page, total)}
  onError={error => console.error(error.message)}
/>;
```

Native accepts absolute paths, `file://` and permitted Android `content://` URIs.
Web accepts `blob:` URLs. HTTP(S), `data:` and relative sources are rejected.
The application handles file permissions and keeps the file/Blob alive while in use.

## Web

Install `react-pdf@9.2.1 pdfjs-dist@4.8.69 react-native-web`, then apply the supplied fixes:

```sh
node node_modules/@makit-kit/react-native-pdf/scripts/apply-web-patches.cjs
```

Add that command to your application's `postinstall`. It checks exact peer versions,
applies bundled patches in place, and safely accepts already-patched installations.
Native-only applications do not need Web peers or patches. The helper uses the system
`patch` command (available on macOS/Linux; on Windows use Git Bash or WSL).

Configure `react-native` → `react-native-web` and prefer `.web` extensions in your
bundler. Webpack bundles the PDF.js and search workers locally; no CDN is used.
Your application owns offline availability of its own JS/worker assets.

## Documentation

- [Full API and reading modes](docs/api.md)
- [Expo development builds](docs/expo.md)
- [Platform parity and limitations](docs/parity.md)
- [Develop, test and publish](CONTRIBUTING.md)
- [Example application](example/README.md)

## Develop

```sh
npm ci
npm run patch:web
npm test
npm run typecheck
npm run build
npm run web                 # http://127.0.0.1:8093
npm run build:site          # site-dist/ includes docs and /demo/
npm run start --workspace pdf-reader-expo-example
```

## License and attribution

MIT. The native renderer derives from Wonday's react-native-pdf 7.0.4; retain
[LICENSE](LICENSE) and [NOTICE](NOTICE). Existing native identifiers retain their original
prefix for registration compatibility. Install only one scoped copy in a native app to avoid duplicate native registrations. There is no dependency on the originating application.
