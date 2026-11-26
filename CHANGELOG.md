# Change Log for the Eightshift Frontend Libs Tailwind

All notable changes to this project will be documented in this file.

This projects adheres to [Semantic Versioning](https://semver.org/) and [Keep a CHANGELOG](https://keepachangelog.com/).

---

## [4.0.1]

### Changed

- `bun start` now publishes eligible frontend, editor and admin CSS changes without rebuilding JavaScript or SSR. No theme configuration change is required. Custom build hooks and changes with uncertain dependencies still trigger a full build.
- Watch builds can reuse unchanged frontend and admin bundles on editor-only saves, and unchanged SSR bundles when edits fall outside their dependency graph.

### Added

- Two opt-in watch modes: `watch.hotUpdates` updates supported styles and plain JSX text in place and offers a manual refresh for other changes; `watch.autoRefresh` reloads the page after a successful build. Both are off by default. See the [watch configuration](README.md#bun-build-migration).

## [4.0.0]

### Changed

- **Breaking:** Replace the bundled Webpack configuration and `webpack/*` API with Bun build helpers. Existing projects must migrate their build scripts, configuration and WordPress asset integration. Bun 1.4.4 or newer is required. See the [migration guide](README.md#bun-build-migration).
- **Breaking:** Conventional theme builds target WordPress 7.0 or newer and require PHP integration that reads generated asset metadata and enqueues its dependencies. Coreless builds require a detectable target version; some WordPress import forms still require core files or installed packages.
- **Breaking:** Conventional theme editors use a unified ES module graph and register asynchronously by default. This requires PHP integration supporting `eightshift-editor-v1`. Dependent classic scripts must await readiness; projects requiring synchronous registration can configure independent editor sharing.
- **Breaking:** Built-in theme publication uses structured asset directories. Integrations that assume flat asset paths must use the manifest and retain the generated directory structure. Successful default publication replaces `public/`; keep manually maintained files elsewhere.
- Frontend and admin entry scripts load their bundled modules asynchronously. Keep their generated chunks alongside the entry scripts. Theme builds produce optimized assets even in watch mode; there is no hot reload.
- Use Bun's formatter instead of Prettier for this repository. The published ESLint configuration no longer runs Prettier, so consumers must run a separate formatting check. Downgrade ESLint to 9 for compatibility with the React lint plugin.
- Optimize `@eightshift/ui-components` imports by default in conventional theme builds.

### Added

- A conventional theme preset and lower-level Bun build APIs for frontend, editor and admin assets, Tailwind CSS, responsive classes, WordPress dependency metadata and standalone CommonJS SSR entries. External source maps are available on request.
- Frontend and admin JavaScript imports of CSS, including package stylesheet exports and CSS modules. Lazy styles load with their importing modules, and local assets are published with their stylesheets.
- The `eightshift-build` CLI with build and watch commands, progress output, and quiet and verbose modes. Watch builds run serially and restart the worker when the selected configuration, root package manifest or Bun lockfile changes.
- Optional native editor sharing and `editor.pureJsxGroups` for unified builds. Lower-level editor builds default to independent sharing.
- Staged theme publication with extra files, manifest aliases and explicit file retention. The `removeUnreferencedStyles` option enables cleanup for custom CSS when using the default publisher.
- Optional same-origin shared fonts through `sharedFonts`. This is disabled by default and requires a compatible UI Components font manifest and PHP integration.
- `lazyComponent` from `/scripts` and `/scripts/helpers` for deferred React components, with named or inferred exports, a Suspense fallback, and forwarded props and refs. It replaces `createChunkedComponent` without a compatibility alias; migrate imports to `lazyComponent` and review the default fallback.

## [3.5.1]

### Fixed

- Fixed stylelint false positives on Tailwind `@apply`: `at-rule-prelude-no-invalid` now ignores `@apply`, as the CSS Mixins spec `@apply` syntax only accepts dashed idents.
- Fixed stylelint false positives on `&` inside `@utility` and `@custom-variant` (`nesting-selector-no-missing-scoping-root`).
- Fixed stylelint false positives on declarations in at-rules nested inside `@utility`, such as `@supports` (`no-invalid-position-declaration`).

### Updated

- Updated dependencies (`@wordpress/dependency-extraction-webpack-plugin` 7, `@wordpress/api-fetch` 8, `stylelint`, `eslint`, `oxlint`, `webpack`, `webpack-cli`, `@swc/core`, `eslint-plugin-better-tailwindcss`, `prettier`, `lint-staged`).
- `@wordpress/dependency-extraction-webpack-plugin` 7 requires Node.js 22.13 or newer.

## [3.5.0]

### Added

- `tw-sweep` CLI (`bunx tw-sweep`, also `lint:tw`): checks Tailwind classes in block manifests and PHP against the project's Tailwind entry and reports unknown and non-canonical classes. `--write` rewrites non-canonical ones. PHP sources: `class="…"` attributes, string arguments of `tailwindClasses`/`getTwPart` (after the part name), `getTwClasses`, `clsx` and `classnames`, and non-key string literals between `// tw-sweep-classes-start.` and `// tw-sweep-classes-end.` (the full stop keeps PHPCS happy; the markers match without it too).
- `linters/oxlint.config.mjs`: `createOxlintConfig({ entryPoint })` for oxlint with `eslint-plugin-better-tailwindcss`.
- `tw-ignore.json`: one unknown-class ignore list (JSON array of regex strings) read by both `tw-sweep` and `createOxlintConfig`. Invalid patterns fail loudly.
- lint-staged does not run commands through a shell, so chain tools as an array: `"*.js": ["bun lintJs", "bun lintJs:oxlint"]`.

## [3.4.0]

### Added
- Added `_twcOptions` to `tailwindClasses` function to allow for more flexible behavior (e.g., ignoring editor classes, disabling part debug classes, and indicating server-side rendering).

### Fixed
- SSR compatibility for `tailwindClasses` function, ensuring it works correctly in server-side rendering contexts.

### Removed

- Legacy `getTwPart`, `getTwDynamicPart`, `getTwClasses` functions (deprecated since 1.4.0).

### Updated

- Updated dependencies.

## [3.3.0]

### Changed

- Updated dependencies (`eslint`, `@swc/core`, `@tailwindcss/webpack`, `@wordpress/dependency-extraction-webpack-plugin`, `stylelint`, `terser-webpack-plugin`, `prettier-plugin-tailwindcss`, `@wordpress/api-fetch`, `globals`).
- Updated Prettier `printWidth` to 300 and reformatted source files accordingly.
- Updated `lintJs` script to call `eslint` directly and removed the redundant `lint` alias.
- Updated Husky `pre-commit` hook to run `bun lint-staged --quiet` directly.

### Removed

- Removed `*.php` entry from `lint-staged` config.

### Fixed

- Fixed `no-param-reassign` ESLint warnings in block/variation registration and the Tailwind responsive key extractor.

## [3.2.0]

### Added

- Built-in Tailwind responsive class compiler: scans every `manifest.json`, extracts classes from `twClasses`, `twClassesEditor` and `twClassesEditorOnly`, expands `responsive: true` blocks across all configured breakpoints, and writes `es-tw-frontend-classes.txt` and `es-tw-editor-classes.txt` at the project root. Runs before each build and on manifest changes in watch mode.
- New `tailwindBreakpoints` option on `eightshiftConfig` (defaults to `['sm', 'md']`).

### Changed

- **Breaking:** default CSS rule now uses `@tailwindcss/webpack` instead of `postcss-loader`. Projects that previously set `overrides: ['css']` and re-declared their own CSS rule and `esTwResponsiveCompiler` plugin should remove that boilerplate and rely on the libs defaults.

### Removed

- `postcss` and `postcss-loader` dependencies.

## [3.1.2]

### Fixed

- Re-added missing `stylistic` `stylelint` rules.

## [3.1.1]

### Fixed

- Re-added missing `stylelint` dependencies.

## [3.1.0]

### Updated

- Updated dependencies.
- Updated package scripts to use Bun instead of npm.
- Updated ESLint rules so unused variables and imports throw errors.
- `FileSelector` now passes additional props to `FilePickerShell`.

### Removed

- Removed Stylelint scripts and configuration from the package.

## [3.0.0]

### Updated

- Updated dependencies.
- Bumped min. version of `@eightshift/ui-components` to 7.0.0.

### Removed

- Removed `__useSmartImageNext` prop from `MediaPicker`.

## [2.4.0]

### Added

- Option to try out `__SmartImageNext` in the `MediaPicker` component (via the `__useSmartImageNext` prop).

### Updated

- Updated dependencies.
- Bumped min. version of `@eightshift/ui-components` to 6.1.0.

## [2.3.0]

### Added

- Re-added React ESLint rules.

### Updated

- Fixed ESLint configs.
- Updated dependencies.

## [2.2.0]

### Added

- Default portalling for `Options` components in `GutenbergBlock` (`document.body` by default). Can be disabled by passing `optionsPortalElement={false}`.

### Changed

- Updated dependencies.

## [2.1.1]

### Changed

- Updated Media and File pickers image component.

## [2.1.0]

### Changed

- New design for Media and File pickers.
- `ManageFileButton` now has a prop passthrough for the button inside (`buttonProps`).
- Updated dependencies.

## [2.0.7]

### Added

- Output block/component title in `tailwindClasses` if WP_DEBUG is true. Depends on Eightshift Libs v10.11.2 `addEditorBodyDebugClass` method.

## [2.0.6]

### Changed

- Updated dependencies.
- Package will now use your project's version of ES UI components, instead of bundling one. `peerDependencies` should automatically install it, if not please install `@eightshift/ui-components` yourself.

## [2.0.5]

### Changed

- Updated dependencies.
- `GutenbergBlock` now overrides the ES UI components portal, after Core changed editor to be iframed. This can be disabled by passing `toolbarPortalElement={false}` and `editorPortalElement={false}`. Override only happens if the editor is iframed.

## [2.0.4]

### Changed

- Updated dependencies.

## [2.0.3]

Co-authored with @piqusy

### Changed

- Updated dependencies.

### Fixed

- Prop not being passed in Media picker causing 'Replace' to not highlight existing selection.

## [2.0.2]

### Fixed

- Broken import on mjs files.

## [2.0.1]

### Removed

- Some @wordpress packages, they will use the WP-provided ones now.

### Changed

- Updated dependencies.
- Tweaked Webpack config not to externalize "@wordpress-dom-ready"

## [2.0.0]

### Removed

- All legacy built-in blocks.

### Changed

- Updated WordPress dependency extraction webpack plugin - React 19 is now supported!
- Updated dependencies.

## [1.5.0]

### Added

- Rive-related strings to `FilePicker`.

### Changed

- Updated dependencies.
- Updated internal components to use ES UIC 2.x/3.x classnames.

## [1.4.8]

### Added

- `domain parameter` to setCookie function.

## [1.4.7]

### Changed

- Fixed Image component "image" part tailwind class output if not set.
- Fix Image component responsive output Co-authored-by: goran.alkovic@infinum.com
- Add "Auto" width to wrapperContent and set is as defaults
- Add a buttonType attribute to Button component
- Implement a11y for Icon component either by setting aria-hidden to true (default) or using the existing iconName label from manifest options key
- Updated dependencies.

## [1.4.6]

### Changed

- Tweaked webpack config to properly include font files from `@eightshfit` packages from `node_modules`.
- Added a new `buildWpRestUrl` helper for easily fetching WP REST URLs. (Similar to `fetchFromWpRest`, but allows you control over how you fetch).
- Updated dependencies.

## [1.4.5]

### Changed

- `BlockInserter` is now only visible when the block it's assigned to is selected. This behavior can be changed by setting `alwaysVisible`.

### Fixed

- Image responsive breakpoints render order in the frontend.

## [1.4.4]

### Added

- Support for `supports` key in block manifests during block registration.

### Changed

- Built-in Paragraph block now uses the new block splitting logic from WP 6.6
- Updated dependencies

## [1.4.3]

### Fixed

- Fixing Yoast SEO plugin helpers.
- Manifests in some default blocks not using `base` as a `part`.
- Image sizing in the default Image block when set to stretch.
- Class for gradient _top_ direction in wrapper.

## [1.4.2]

### Fixed

- Fixed bug with `combinations` output in `tailwindClasses` helper.
- Fixed CSS `url()` imports for images not working due to Webpack config.

## [1.4.1]

### Changed

- `tailwindClasses` check will now work even if no `parts` are defined.

## [1.4.0]

### Added

- Introduced new, more flexible `tailwindClasses` function.
- Added basic warnings for misconfigurations of parts and options.
- Updated block and component schemas with new Tailwind functionalities.
- Updated default blocks with new Tailwind functions.

### Changed

- **Potentially breaking**: `twClassesEditor` is now appended to `twClasses`. Use `twClassesEditorOnly` for editor-only classes.
- **Potentially breaking**: The `parts` key in manifest now supports specifying multiple parts using a comma-separated string.
- Classes can now be applied to multiple parts in one option or combination, including responsive options.
- Default Stylelint config will no longer report `@tailwind` rules.
- Updated dependencies.

## [1.3.3]

### Changed

- Updating schema.

## [1.3.2]

### Fixed

- Fixing theme options to use stringified JSON instead of an object.

## [1.3.1]

### Added

- Helper `getFilteredAttributes` for SSR components to filter unwanted attributes and optimize output.

## [1.3.0]

### Added

- `twClasses` and `twClassesEditor` can now be passed as arrays.

### Changed

- Updated schemas to support the changes in `twClasses`/`twClassesEditor`.
- Tailwind output functions now output custom classes if no Tailwind classes are detected.
- Tweaked Prettier config.
- Updated dependencies.

## [1.2.0]

### Fixed

- Fixed default `perPage` param in `wpSearchRoute`.
- Fixed bugs in built-in blocks.

### Added

- Added support for `hidden` prop and accepted types passthrough for image and file pickers.

### Changed

- Updated dependencies.

## [1.1.1]

### Fixed

- Fixed default global manifest.

### Removed

- Removed erroneous styles.

## [1.1.0]

### Added

- Added new options to the fetch script: `truncateTitle` and `labelProp`.
- Added `hidden` prop to `BlockInserter`.
- Added `PickerPlaceholder` component.
- Added dynamic parts option and `getTwDynamicPart` helper.

### Changed

- Updated dependencies.
- Tweaked fetch script to use WP `apiFetch`.
- Updated some built-in blocks.
- Tweaked ESLint config.
- Updated base blocks.

### Removed

- Removed `urlBase` option from fetch script.
- Moved fonts from Google Fonts to built-in.
- Removed `.gitignore` ESLint ignore.

## [1.0.0]

### Added

- Initial release.

[4.0.1]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/4.0.0...4.0.1
[4.0.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/3.5.1...4.0.0
[3.5.1]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/3.5.0...3.5.1
[3.5.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/3.4.0...3.5.0
[3.4.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/3.4.0...3.4.0
[3.3.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/3.2.0...3.3.0
[3.2.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/3.1.2...3.2.0
[3.1.2]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/3.1.1...3.1.2
[3.1.1]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/3.1.0...3.1.1
[3.1.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/3.0.0...3.1.0
[3.0.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.4.0...3.0.0
[2.4.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.3.0...2.4.0
[2.3.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.2.0...2.3.0
[2.2.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.1.1...2.2.0
[2.1.1]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.1.0...2.1.1
[2.1.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.0.7...2.1.0
[2.0.7]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.0.6...2.0.7
[2.0.6]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.0.5...2.0.6
[2.0.5]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.0.4...2.0.5
[2.0.4]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.0.3...2.0.4
[2.0.3]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.0.2...2.0.3
[2.0.2]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.0.1...2.0.2
[2.0.1]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/2.0.0...2.0.1
[2.0.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.5.0...2.0.0
[1.5.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.4.8...1.5.0
[1.4.8]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.4.7...1.4.8
[1.4.7]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.4.6...1.4.7
[1.4.6]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.4.5...1.4.6
[1.4.5]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.4.4...1.4.5
[1.4.4]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.4.3...1.4.4
[1.4.3]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.4.2...1.4.3
[1.4.2]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.4.1...1.4.2
[1.4.1]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.4.0...1.4.1
[1.4.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.3.3...1.4.0
[1.3.3]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.3.2...1.3.3
[1.3.2]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.3.1...1.3.2
[1.3.1]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.3.0...1.3.1
[1.3.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.1.1...1.2.0
[1.1.1]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/0.0.1...1.0.0
