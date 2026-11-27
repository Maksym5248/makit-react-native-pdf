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

The npm scope is `@makit-kit`. Releases are published by
`.github/workflows/publish.yml` through npm Trusted Publishing (OIDC), without an
npm token in GitHub secrets. A stable tag such as `v0.1.0` must match
`package.json`, and its commit must already belong to `main`. The workflow runs
all CI checks, builds/packs the package, then publishes the resulting archive.
The owner reviews and merges changes before creating a release tag.

### One-time npm setup

For a new package, first publish the reviewed archive from your authenticated
terminal, then configure **Trusted Publisher** in the package settings on npm:

- Provider: GitHub Actions
- Organization or user: `Maksym5248`
- Repository: `makit-react-native-pdf`
- Workflow filename: `publish.yml`
- Environment: leave empty (the workflow does not use an environment)
- Allowed actions: enable direct `npm publish`

The first package/archive is prepared locally in `.verification/`:

```sh
npm login
npm publish .verification/makit-kit-react-native-pdf-0.1.0.tgz --access public
```

Do not create a tag for an already published version: npm versions cannot be
republished. For subsequent releases, update the version, review and merge the
change, then push the matching `vX.Y.Z` tag. A newly configured trusted publisher
must complete a successful publication within two days or be configured again.
See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

## Website

`npm run build:site` creates `site-dist/`, including `/demo/`. Serve with
`python3 -m http.server 8094 --directory site-dist`. Relative paths support repository
subpaths on GitHub Pages. `.github/workflows/pages.yml` builds and deploys to the Pages
environment automatically after a merge/push to `main`, or through a manual workflow dispatch.
Repository Pages settings must use **GitHub Actions** as the source. Pull requests run
validation without publishing the site.
