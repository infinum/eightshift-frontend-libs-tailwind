# Change Log for the Eightshift Frontend Libs Tailwind

All notable changes to this project will be documented in this file.

This projects adheres to [Semantic Versioning](https://semver.org/) and [Keep a CHANGELOG](https://keepachangelog.com/).

---

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

[Unreleased]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/master...HEAD
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
