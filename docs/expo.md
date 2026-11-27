# Expo setup

The package includes native views and a TurboModule. Use an **Expo development build**;
Expo Go cannot load this native implementation.

The included example targets **Expo SDK 55 / React Native 0.83.10 / React 19.2** to match
the library's current React Native line. Later SDKs require their own build/runtime validation;
the package does not claim that every newer React Native version has been tested.

## Existing application

Install the reader and Expo development client in your application.

```sh
npx expo install expo-dev-client
npm install @makit-kit/react-native-pdf
```

Add the plugin to `app.json`:

```json
{
  "expo": {
    "plugins": ["@makit-kit/react-native-pdf"]
  }
}
```

The plugin adds `https://jitpack.io` to Expo's `android.extraMavenRepos` Gradle property and preserves existing repository entries.
React Native autolinking discovers the Android package, iOS pod and Codegen inputs.
The plugin does not add broad file permissions, downloaders, network APIs or iOS entitlements.
If you use `expo-build-properties`, list the PDF reader plugin **after** it so existing repository configuration is preserved.

```sh
npx expo prebuild
npx expo run:ios --device
# Select an existing simulator, or use:
npx expo run:android
npx expo start --dev-client
```

Prebuild generates native projects. Avoid `--clean` on projects with native changes you
need to keep. Rebuild the development client after installing/changing native dependencies.

## Included example

From the repository root:

```sh
npm ci
npm run prebuild --workspace pdf-reader-expo-example
npm run ios --workspace pdf-reader-expo-example -- --device "iPhone 18 Pro"
# Or use an existing Android emulator:
npm run android --workspace pdf-reader-expo-example
npm run start --workspace pdf-reader-expo-example
```

**Open PDF** uses `expo-document-picker` with `copyToCacheDirectory: true` so the reader
gets an accessible local URI. The bundled guide opens through `expo-asset` as a local file. Neither operation uploads a document.
File selection/storage belongs to this example, not to the library.

The Web demo uses Webpack and local workers, as documented in the main README.
Expo Metro Web is not currently a verified Web bundler for this package.

## iOS 27 with the SDK 55 example

The SDK 55 template uses the legacy application lifecycle. When built with the iOS 27
SDK, the example needs a scene delegate. Its local `plugins/with-ios-scene.cjs` config
plugin adopts one scene and forwards link handling to the existing Expo AppDelegate.
It runs during Prebuild, so the generated native directories remain disposable.

This is an example bootstrap requirement; the published PDF plugin does not change
an application's lifecycle. Existing apps own their scene setup. Newer Expo SDKs need
their own compatibility validation with this library.

## Sources

- [Expo SDK 55](https://expo.dev/changelog/sdk-55)
- [Development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Build properties / extraMavenRepos](https://docs.expo.dev/versions/v55.0.0/sdk/build-properties/)
