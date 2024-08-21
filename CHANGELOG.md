
# Change Log for the Eightshift Frontend Libs Tailwind
All notable changes to this project will be documented in this file.

This projects adheres to [Semantic Versioning](https://semver.org/) and [Keep a CHANGELOG](https://keepachangelog.com/).

## [1.3.0] - 2024-08-08
- `twClasses` and `twClassesEditor` can now be passed as an array
- Updated schemas to account for the `twClasses`/`twClassesEditor` changes.
- Tailwind output functions will now output the custom classes if no Tailwind classes are in the output.
- Tweaked Prettier config.
- Updated dependencies.

## [1.2.0] - 2024-08-08
- Fixed default `perPage` param in `wpSearchRoute`.
- Updated image and file pickers with support for `hidden` prop and accepted types passthrough.
- Fixed some reported bugs in a couple of built-in blocks.
- Updated dependencies.

## [1.1.1] - 2024-07-11
- Fixed default global manifest.
- Removed erroneous styles.

## [1.1.0] - 2024-07-09
- Updated dependencies.
- Tweaked fetch script to use WP `apiFetch`.
- Added new options to the fetch script: `truncateTitle` and `labelProp`
- Removed `urlBase` option from fetch script, as it's no longer needed.
- Updated some built-in blocks
- Moved fonts from Google Fonts to built-in.
- Removed `.gitignore` ESLint ignore.
- Tweaked ESLint config.
- Updated base blocks.
- Added `hidden` prop to `BlockInserter`.
- Added `PickerPlaceholder` component.
- Added option for dynamic parts and the `getTwDynamicPart` helper.

## [1.0.0] - 2024-06-17
- Initial release.

[Unreleased]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/master...HEAD

[1.3.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.2.0...1.3.0
[1.2.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.1.1...1.2.0
[1.1.1]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/infinum/eightshift-frontend-libs-tailwind/compare/0.0.1...1.0.0
