![image](https://repository-images.githubusercontent.com/180566063/638d50be-e474-42e5-9673-1d35365ace05)

[![GitHub tag](https://img.shields.io/github/tag/infinum/eightshift-frontend-libs-tailwind.svg?style=for-the-badge)](https://github.com/infinum/eightshift-frontend-libs-tailwind/)
[![GitHub stars](https://img.shields.io/github/stars/infinum/eightshift-frontend-libs-tailwind.svg?style=for-the-badge&label=Stars)](https://github.com/infinum/eightshift-frontend-libs-tailwind/)
[![license](https://img.shields.io/github/license/infinum/eightshift-frontend-libs-tailwind.svg?style=for-the-badge)](https://github.com/infinum/eightshift-frontend-libs-tailwind/)
<!-- [![codecov](https://img.shields.io/codecov/c/gh/infinum/eightshift-frontend-libs/develop?label=Codecov&style=for-the-badge&token=ScdMBJWv59)](https://codecov.io/gh/infinum/eightshift-frontend-libs-tailwind/) -->

# Eightshift Frontend Libs Tailwind

This library is meant to bring you the modern front-end development tools to the [Eightshift Boilerplate](https://github.com/infinum/eightshift-boilerplate) or [Eightshift Boilerplate Plugin](https://github.com/infinum/eightshift-boilerplate-plugin), but you can use it on any WordPress project.

## Documentation
**For the full documentation please check this [link](https://eightshift.com).**

## Bun build migration

The Webpack configuration and `webpack/*` imports have been removed. Projects must replace their Webpack configuration and scripts; this is a breaking change. The Bun helpers are available from `@eightshift/frontend-libs-tailwind/bun/build.mjs`, including `build`, `generateDiscovery`, `generateResponsiveClasses`, and `wordpressPlugin`.

The Bun helpers are not a drop-in replacement for Webpack. Start with the theme preset for the conventional Eightshift theme layout. Use the lower-level API below for other layouts.

The conventional theme build requires a stable WordPress 7.0 or newer installation. Each build reads `wp-includes/version.php` before modifying output and fails if the version is missing, unrecognized, or too old. By default, the WordPress root is three directories above the theme root; set `EIGHTSHIFT_WP_ROOT` to its absolute path for other layouts. The public asset URL defaults to the theme's path under that root plus `/public/`. If that does not match the site's URL layout, set `publicPrefix` in `defineThemeBuild` or `EIGHTSHIFT_PUBLIC_PREFIX` in the environment to the root-relative public URL path, including its trailing slash (for example, `/wp-content/themes/example/public/`). The option takes precedence over the environment variable. The lower-level build API does not enforce this version check.

### Migrate a conventional theme

1. Keep a working copy of your current build and compare its outputs before removing Webpack. Install a version of this library that contains the Bun build helpers, using Bun, and commit the updated lockfile when that version is available.
2. Replace the Webpack configuration with `eightshift.build.mjs` at the project root:

   ```js
   import { defineThemeBuild } from '@eightshift/frontend-libs-tailwind/bun/theme-build.mjs';

   export default defineThemeBuild({
     root: import.meta.dirname,
   });
   ```

3. Update the relevant `package.json` scripts:

   ```json
   {
     "scripts": {
       "start": "eightshift-build watch",
       "build": "eightshift-build build",
       "build:sourcemaps": "eightshift-build build --sourcemaps"
     }
   }
   ```

4. Run `bun run build` and compare the generated assets and site behavior with the previous build. Use `bun run start` for an initial build and subsequent rebuilds, or `bun run build:sourcemaps` for external source maps. The CLI accepts `--config path` to select another configuration. It is `eightshift-build`, not `bun build`: the library orchestrates CSS, discovery, WordPress dependencies and publication around Bun's bundler.
5. Update CI and deployment to use Bun and the new scripts. Only remove Webpack dependencies and configuration after verifying the new build. Ensure the deployment environment has access to WordPress and its compatible script metadata for dependency extraction.

The default preset discovers conventional block and component assets, builds frontend, editor and admin scripts and styles, and builds conventional SSR entries when present. SVG imports in frontend and admin scripts emit files referenced by root-relative public URLs; editor SVG imports produce SVG text instead. The default build clears `public/` first, writes intermediate assets inside `public/.build`, and publishes the final assets and `public/manifest.json` directly to `public/`. Successful builds remove `public/.build`; failed builds can leave incomplete output. Do not keep manually maintained files in `public/`. Frontend and admin use classic-script bootstraps that dynamically import their bundled modules; the editor is packaged separately. Preserve the generated chunks alongside the entry scripts. The default preset always produces production-optimized assets, including in watch mode; watch does not provide hot reload. With `--sourcemaps`, external maps are generated for the editor entry and its lazy chunks as well as the browser bundles. SSR execution may still require Node in the project's PHP integration.

The manifest maps the conventional `applicationBlocksFrontend`, `applicationBlocksEditor` and `applicationAdmin` script and style keys to their generated files. Each entry also has `.asset.json` metadata containing WordPress dependency handles and a release version; the manifest maps its legacy `.json` key to that metadata as well. **The build does not enqueue assets:** confirm that your installed PHP integration reads the generated metadata and merges its dependencies with the registered handles. Existing PHP/library versions may not support this; update or adapt them before switching, and check that the frontend, editor and admin load without missing globals. Do not assume Bun's `external` option supplies WordPress global mappings.

Each build clears the previous `public/` contents. Run only one build or publication per theme at a time; output directories are not locked against concurrent builds. The PHP manifest cache update is not coordinated with PHP cache rebuilds: if they overlap, stale asset URLs can remain until the next successful build or cache reset. Build failures may leave the site without working assets; use a separate deployment process if atomic releases are required, and account for cached pages that may still request removed files. Verify block registration, editor controls and save/reload behavior, frontend styles and lazy assets, representative admin screens, script dependencies, browser console and asset URLs. Keep the previous Webpack build available for rollback until the new build is verified.

### Lower-level build API

For a nonstandard project, run the following as a project-root `build.mjs`, adapting the paths to your project:

```js
import { join } from 'node:path';
import { build } from '@eightshift/frontend-libs-tailwind/bun/build.mjs';
import { processCss } from '@eightshift/frontend-libs-tailwind/bun/css.mjs';
import { watchBuild } from '@eightshift/frontend-libs-tailwind/bun/watch.mjs';

const root = process.cwd();
const production = process.argv.includes('--production');
const run = () => build({
  root,
  outdir: 'build',
  entries: { app: 'src/app.js' },
  wpRoot: '../../..', // WordPress root from wp-content/themes/<theme>
  responsive: {},
  css: async ({ outdir, responsive }) => {
    await processCss({
      projectDir: root,
      outputFile: join(outdir, 'app.css'),
      files: [{ file: 'src/tailwind.css', scan: true, scanFiles: [responsive.frontend] }],
      production,
    });
  },
  buildOptions: { minify: production },
});

if (process.argv.includes('--watch')) {
  const watcher = watchBuild({
    projectDir: root,
    sources: ['src'],
    ignored: ['build'],
    build: run,
  });
  process.on('SIGINT', async () => { await watcher.stop(); process.exit(); });
  process.on('SIGTERM', async () => { await watcher.stop(); process.exit(); });
} else {
  await run();
}
```

Run `bun run build.mjs`, add `--production` for minification, or `--watch` for an initial build followed by rebuilds. Watch covers only the listed paths, so include other inputs such as configuration files; generated output must be ignored. Directories are watched recursively, files through their parent directories, and missing sources through their nearest existing parents until they appear. Builds run serially with a 200 ms debounce; errors go to `onError` (default `console.error`). `initial: false` skips the initial build. `stop()` closes the watcher and waits for an active build. There is no development server or hot reload.

`build` requires named entries and an output directory. By default, it builds each entry separately as browser ESM with splitting and hashed filenames, writes `manifest.json` and an `<entry>/<entry>.asset.json` with dependencies and a version hash, and returns `{ outdir, entries }`. Integrate these files with your WordPress enqueue code; this package does not enqueue them. Output is staged and published only after success. An existing output directory must have the build's ownership marker, and output paths and trees cannot contain symlinks. Do not use a directory containing the project root. `buildOptions` can override Bun defaults such as `target`, `format`, `splitting`, `naming`, loaders and plugins; callers must ensure the resulting format matches their WordPress loading strategy. Entry points, output directory and write mode are controlled by the build API.

For projects that prefer a validated configuration, `createPreset` and `buildPreset` are exported from `@eightshift/frontend-libs-tailwind/bun/preset.mjs`. Pass `wordpress: false`, `discovery: false`, `responsive: false` or `css: false` to disable the corresponding feature; discovery, responsive generation and CSS are opt-in. Configure CSS surfaces or pass a custom CSS callback. `buildOptions` accepts the same overrides as `build`. When an editor entry is enabled, `buildOptions.sourcemap` supports only `none` and `external`. The editor entry and each lazy chunk are bundled separately: modules included in more than one bundle may initialize more than once and have separate state. Avoid relying on shared module identity or one-time side effects across those bundles.

For `defineBuild` watch configurations with `ssr` or `publish` callbacks, explicitly set `watch.sources` or `watch.ignored`. Exclude every path those callbacks write inside the project root, including paths outside the preset output directory, to avoid rebuild loops.

`defineThemeBuild` from `bun/theme-build.mjs` supplies the conventional theme layout and flat publication. `entries` replaces the complete entry map; `editor` replaces the editor preset or may be `false`. `responsive` accepts the preset's options or `false`. `css` accepts an async callback receiving `{ root, outdir, stage, responsive, require }` or `false`; `extraCss` still runs afterwards. `discovery` accepts a plugin factory receiving `{ root, setEditorWorker, getEditorWorker }` (also async) or `false`; with either override, callers must provide discovery compatible with their entry sources. `frontendStyles` applies only to default discovery. The built-in editor worker plugin runs before plugins returned by `createPlugins`; replace it via `media.editorWorker` when custom handling is needed. The returned plugin array is not modified. `ssr` replaces `buildSsr` or can be `false`; do not specify both. `publish` replaces the flat publisher with an async callback receiving the build state, or `false` leaves the intermediate build unpublished in `public/.build`. With custom or disabled publication, the SSR callback runs after the browser build and receives the build state and `mode: 'production'`.

### Additional and lazy stylesheets

Use `extraCss` to compile ordered stylesheets separately from the standard frontend, editor and admin CSS. This is useful for a library used by only one frontend component:

```js
import { defineThemeBuild } from '@eightshift/frontend-libs-tailwind/bun/theme-build.mjs';

export default defineThemeBuild({
  root: import.meta.dirname,
  extraCss: [{
    files: ['package:@vidstack/react/player/styles/base.css'],
    keys: ['components/video'],
  }],
});
```

- `files` is a non-empty array processed in order. Paths are relative to the project root; absolute paths and `package:` module specifiers are also supported. Each item may instead be a `processCss` options object with a `file` property.
- `output` is optional. By default the filename is `extra-<hash>.css`, using the first 20 hexadecimal characters of the SHA-256 hash of the compiled CSS bytes. Set `output: 'video.css'` for a stable filename. Names must be flat CSS filenames and must not collide with other outputs.
- `keys` optionally lists frontend importer keys, such as `components/video` or `custom/example`. Each must match a discovered `src/Blocks/{components,custom}/**/assets/index.js` file, and a key can belong to only one stylesheet group. When an importer is used, its stylesheet loads before the JavaScript; the load is shared between callers. A failed load rejects, removes the link, and can be retried. Without `keys`, the file is built and published but is not loaded automatically.
- `href` optionally overrides the URL used by those importers. By default it points to the generated output; custom URLs must be deployed and kept in sync by the project. It has no effect without `keys`.

The default flat publisher includes generated stylesheets in `public/` and its manifest; no alias is required for lazy loading. The output hash changes when compiled CSS changes, including rewritten asset URLs. CSS assets are copied with their own content-hashed names. Publication replaces `public/`, so cached older pages can request files no longer present; retain old releases externally if that matters. For a stable PHP manifest key, set an explicit `output` and an appropriate `aliases` entry. Custom publishers must preserve the CSS and the URL expected by the importer.

The build regenerates discovery and CSS on each rebuild. Watch monitors the configured project paths, not `node_modules` or arbitrary external files by default; customize `watch.sources` for additional inputs. Default theme builds use production CSS processing, including Lightning CSS minification and its browser targets, even in watch mode. `extraCss` may also be an async hook receiving `{ root, stage, require }`, or `false` to disable it. Hooks are responsible for their own filenames and loading behavior. `frontendStyles` separately attaches existing URLs to keys; both automatic mechanisms require default discovery.

Default flat publication requires frontend, admin and editor entries, an editor build, and CSS at the conventional filenames. It scans the conventional SSR source glob and expects matching outputs in `public/.build/ssr/production`; use `ssr: false` to omit SSR or supply custom publication for a different layout. Disabling responsive generation requires custom or disabled CSS. Custom publication is required when disabling CSS or the editor, or changing the entry set. With custom or disabled publication, intermediate output remains in `public/.build`; the project owns its publication and cleanup.

WordPress externalization is enabled by default. Set `wpRoot` to the WordPress installation when using externalized `@wordpress/*` imports; export discovery reads its core scripts and requires compatible installed package metadata. The adapter also maps React and selected common dependencies to WordPress globals. Those globals and script handles must be available at runtime. Set `wordpress: false` to disable this adapter. For direct Bun integration, `wordpressPlugin({ projectRoot, wpRoot })` returns `{ plugin, dependencies }`; use a fresh adapter for each build and absolute paths.

`processCss` compiles the `files` array in order into one output file. Each item is a path or `{ file, scan, sources, scanFiles, removeSources }`: scanning is opt-in; `sources` adds Tailwind scanner source objects, `scanFiles` adds explicit candidate files, and `removeSources` removes exact source-rule strings (and fails if absent). Relative paths resolve from `projectDir`. Local URL assets are copied next to the CSS with content-hashed names. Production uses Lightning CSS and the `browsers` option (default `>= 0.25%`); the return value includes `outputFile` and discovered `dependencies`. Watch does not automatically use those dependencies. `responsive: {}` generates frontend and editor class lists from `src/**/manifest.json`, expanding responsive classes for `sm` and `md`; customize `breakpoints`, `manifestGlob`, and `output`. Pass the relevant generated list to CSS scanning, as above. The standalone `generateResponsiveClasses({ projectDir, ... })` is also exported from `bun/build.mjs`.

For Webpack context replacements, generate a module before building and import its named context in your application:

```js
import { generateDiscovery } from '@eightshift/frontend-libs-tailwind/bun/build.mjs';

await generateDiscovery({
  root: process.cwd(),
  output: 'src/generated/blocks.mjs',
  definitions: [{ name: 'blocks', directory: 'src/blocks', pattern: /\.js$/, mode: 'sync' }],
});
```

The generated `blocks` function accepts keys such as `./card.js`, and `blocks.keys()` lists them. `mode: 'lazy'` returns promises; synchronous JSON returns parsed values, JS returns module namespaces, and synchronous CSS imports are side effects returning an empty object. Lazy CSS is unsupported. Missing directories produce empty contexts and symlinks are skipped. Regenerate when files are added or removed; if generated files are watched, exclude them to avoid rebuild loops. Alternatively, `build` accepts `discovery: { output, definitions }` and generates the module inside its staging output, exposed as `discovery` to the CSS callback; its output path must be relative to staging, not a stable source import path. Responsive outputs are likewise staged and published.

Verify your assets, WordPress dependencies, CSS and development workflow before migrating. The Tailwind lint plugin still transitively installs `tsconfig-paths-webpack-plugin` for module resolution; the Webpack bundler and former Webpack build plugins are not installed by this package.

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
