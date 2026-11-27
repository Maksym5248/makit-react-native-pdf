# PDF Reader example

An independent consumer of the library's public API with synthetic PDF fixtures.
It includes local-file reading, text search, highlights, thumbnails, page navigation,
rotation, fit and scroll modes, as well as developer API and renderer checks.

From the repository root:

```sh
npm ci
npm run web
npm run build:web --workspace pdf-reader-example
npm run typecheck:example
```

Web runs at http://127.0.0.1:8093. Choose a local PDF or use the synthetic sample.
Files stay on your device. Search the sample for `alpha` (six matches).
The example's Ukrainian labels are retained so its existing UI regression scripts remain useful.

## Native

```sh
cd example
bundle install
cd ios && bundle exec pod install && cd ..
npm start
# Another terminal from example/:
npm run ios
npm run android
```

Use an existing iOS simulator or Android emulator. The iOS launcher defaults to
`iPhone 18 Pro`; pass a different existing device name if needed.
Native URI input requires an accessible absolute/file URI or permitted Android content URI.
See [the Expo example](../docs/expo.md) for a system document picker and development build.

## Checks

```sh
# With the local Web server running:
npm run test:web --workspace pdf-reader-example
npm run test:web-taps --workspace pdf-reader-example
```

Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if Chromium is already installed. Test output
belongs outside git. Only synthetic fixtures may be used in public evidence.
Baseline comparison depends on react-native-pdf solely in this example; the library
itself does not acquire its downloader or blob-util API.

Mock, bundler and browser checks do not prove native runtime. Fresh results for this
standalone copy are recorded in the delivery issue and verification report.
