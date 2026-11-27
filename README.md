# Makit · React Native PDF

A local-first PDF reader for **React Native iOS, Android and Web**. Native rendering,
background text search, highlights and thumbnails — without a WebView or a backend.

> Prepared for publication. The npm package is not yet published.
> Package name: `@makit-kit/react-native-pdf`. Scope ownership must be confirmed before publication.

- **iOS:** PDFKit. **Android:** PDFium / AndroidPdfViewer. **Web:** locally bundled PDF.js workers.
- Read local files, search their existing text layer, navigate matches and render thumbnails.
- File ownership stays with your application. No downloader, upload, analytics, cache service or OCR.
- React 19 / React Native 0.83+, New Architecture. The Expo example targets SDK 55 / RN 0.83.10.

[Documentation and playground](https://maksym5248.github.io/makit-react-native-pdf/)

## Install

Until publication, build and install a local tarball:

```sh
npm ci
npm run patch:web
npm run build
npm pack --pack-destination /tmp
# In your application:
npm install /tmp/makit-kit-react-native-pdf-0.1.0.tgz
# Bare React Native iOS:
cd ios && bundle exec pod install
```

After publication, use `npm install @makit-kit/react-native-pdf` instead.
See [Expo setup](docs/expo.md) for development builds and Prebuild.

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
