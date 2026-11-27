# Contributing

Use Node 20.19+ and npm. Run all commands from the repository root unless stated otherwise.
The repository contains the published library at its root, a bare example in `example/`,
an Expo example in `example-expo/` and static website source in `site/`.

```sh
npm ci
npm run patch:web
npm test
npm run test:expo
npm run test:patches
npm run typecheck
npm run typecheck:example
npm run typecheck:expo
npm run lint
npm run build
npm run test:web-build
npm run build:site
npm run test:package
```

After `npm ci`, `npm run patch:web` applies the exact Web patches in `patches/`. The package does not
run install hooks inside a consuming app; Web consumers explicitly add the helper to
their own postinstall. Updates to Web peers need the patch regression tests as well.

## Examples

```sh
npm run web
npm run build:web --workspace pdf-reader-example
npm run start --workspace pdf-reader-example
npm run ios --workspace pdf-reader-example
npm run android --workspace pdf-reader-example
```

Use an existing simulator/emulator. Automated native tests live in `example/e2e/`
and the native test targets. Review their device selection before running them.
Never use private PDF files as public fixtures or screenshot content.

## Release

1. Verify name/scope ownership and repository URLs; select a version.
2. Run the checks above and native runtime checks on the supported platforms.
3. Run `npm pack --dry-run`, inspect its allowlist, then `npm pack`.
4. Install that exact tarball in a clean consuming app; verify Web and native linking.
5. Authenticate with npm in your own terminal; run `npm publish ./package.tgz --access public`.
6. Verify the published version before tagging the release and announcing it.

Publishing is manual. CI does not contain an npm token or automatic publish action.

## Website

`npm run build:site` creates `site-dist/`, including `/demo/`. Serve with
`python3 -m http.server 8094 --directory site-dist`. Relative paths support repository
subpaths on GitHub Pages. `.github/workflows/pages.yml` builds and deploys to the Pages
environment once a public remote exists and Pages is enabled for GitHub Actions.
