# Change Log for the Eightshift Frontend Libs Tailwind

All notable changes to this project will be documented in this file.

This projects adheres to [Semantic Versioning](https://semver.org/) and [Keep a CHANGELOG](https://keepachangelog.com/).

---

## [1.4.3]

### Fixed

- Fixing Yoast SEO plugin helpers.

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
