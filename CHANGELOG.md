
# Change Log for the Eightshift Frontend Libs Tailwind
All notable changes to this project will be documented in this file.

This projects adheres to [Semantic Versioning](https://semver.org/) and [Keep a CHANGELOG](https://keepachangelog.com/).

## [1.4.2] - 2024-10-03
- Fixed bug with `combinations` output in `tailwindClasses` helper.
- Fixed CSS `url()` imports for images not working because of Webpack config.

## [1.4.1] - 2024-10-01
- `tailwindClasses` check will now work fine even if no `parts` are defined.

## [1.4.0] - 2024-09-30
- Introduced new, more flexible, and simpler to use `tailwindClasses` function. Replaces `getTwPart`, `getTwDynamicPart`, and `getTwClasses`.
	- **Potentially breaking**: `twClassesEditor` is now appended to `twClasses`. If you need editor-only classes, you can now use the `twClassesEditorOnly` key. Editor-only classes replace `twClasses`, but will also have classes from `twClassesEditor`.
	- **Potentially breaking**: `parts` key in manifest now supports specifying multiple parts just with a comma-separated string.
	- You can now apply classes to multiple parts within one option or combination! Also work with responsive options.
	- There are now (basic) warnings for misconfigurations of parts and options.
- Updated block and component schemas with new Tailwind functionalities.
- Updated dependencies.
- Updated default blocks with new Tailwind functions.
- Default Stylelint config will no longer report `@tailwind` rules.

## [1.3.3] - 2024-09-24
- Updating schema.

## [1.3.2] - 2024-09-19
- Fixing theme options to use stringified JSON instead of an object.

## [1.3.1] - 2024-09-13
- Helper `getFilteredAttributes` used on SSR components to filter out unwanted attributes and optimize the output.

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
