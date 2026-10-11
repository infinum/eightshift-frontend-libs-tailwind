![image](https://repository-images.githubusercontent.com/180566063/638d50be-e474-42e5-9673-1d35365ace05)

[![GitHub tag](https://img.shields.io/github/tag/infinum/eightshift-frontend-libs-tailwind.svg?style=for-the-badge)](https://github.com/infinum/eightshift-frontend-libs-tailwind/)
[![GitHub stars](https://img.shields.io/github/stars/infinum/eightshift-frontend-libs-tailwind.svg?style=for-the-badge&label=Stars)](https://github.com/infinum/eightshift-frontend-libs-tailwind/)
[![license](https://img.shields.io/github/license/infinum/eightshift-frontend-libs-tailwind.svg?style=for-the-badge)](https://github.com/infinum/eightshift-frontend-libs-tailwind/)
<!-- [![codecov](https://img.shields.io/codecov/c/gh/infinum/eightshift-frontend-libs/develop?label=Codecov&style=for-the-badge&token=ScdMBJWv59)](https://codecov.io/gh/infinum/eightshift-frontend-libs-tailwind/) -->

# Eightshift Frontend Libs Tailwind

This library is meant to bring you the modern front-end development tools to the [Eightshift Boilerplate](https://github.com/infinum/eightshift-boilerplate) or [Eightshift Boilerplate Plugin](https://github.com/infinum/eightshift-boilerplate-plugin), but you can use it on any WordPress project.

## Documentation
**For the full documentation please check this [link](https://eightshift.com).**

## Tailwind class linting

Two tools check classes against your project's own Tailwind entry: oxlint for JS, and `tw-sweep` for block manifests and PHP. Both read one ignore list.

1. Add `oxlint` to your project's `devDependencies`. Isolated installs (pnpm, `bun --linker isolated`) do not expose this package's binaries.
2. Create `oxlint.config.ts`:

   ```ts
   import { defineConfig } from 'oxlint';
   import { createOxlintConfig } from '@eightshift/frontend-libs-tailwind/linters/oxlint.config.mjs';

   export default defineConfig(createOxlintConfig({ entryPoint: 'tailwind.css' }));
   ```

3. Create `tw-ignore.json` for classes that are not Tailwind utilities (JS hooks, BEM selectors, other design-system prefixes). It is a JSON array of regex strings; an invalid pattern stops both tools:

   ```json
   ["^es:", "^js-", "^my-block__"]
   ```

4. Wire the scripts. lint-staged does not run commands through a shell, so use an array instead of `&&`:

   ```json
   "scripts": {
   	"lintJs:oxlint": "oxlint",
   	"lintTw": "tw-sweep",
   	"test": "bun run lintJs && bun run lintJs:oxlint && bun run lintTw"
   },
   "lint-staged": {
   	"*.js": ["bun lintJs", "bun lintJs:oxlint"],
   	"src/Blocks/**/manifest.json": "tw-sweep",
   	"src/**/*.php": "tw-sweep"
   }
   ```

`tw-sweep` reports unknown and non-canonical classes; `tw-sweep --write` rewrites the non-canonical ones. In PHP it reads static `class="…"` attributes and the string arguments of `tailwindClasses`, `getTwPart`, `getTwClasses`, `clsx` and `classnames`. For class maps that no helper wraps, such as selectors returned from a filter, mark the code:

```php
// tw-sweep-classes-start.
$selectors['field']['parts']['label'] = ['flex items-center text-body-sm'];
// tw-sweep-classes-end.
```

Every string literal between the markers that is not an array key is checked. Run `tw-sweep --help` for all flags.

## Who do I talk to?

If you have any questions or problems, please [open an issue](https://github.com/infinum/eightshift-frontend-libs/issues) on GitHub and we will do our best to give you a timely answer.

## Maintainers
Eightshift Frontend Libs Tailwind is maintained and sponsored by
[Eightshift](https://eightshift.com) and [Infinum](https://infinum.com).

## License
Eightshift Frontend Libs Tailwind [Eightshift](https://eightshift.com) and [Infinum](https://infinum.com). This is free software, and may be redistributed under the terms specified in the LICENSE file.
