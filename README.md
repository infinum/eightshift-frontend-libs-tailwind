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

The conventional theme build requires a stable WordPress 7.0 or newer installation. Each build reads `wp-includes/version.php` before modifying output and fails if the version is missing, unrecognized, or too old. By default, the WordPress root is three directories above the theme root; set `EIGHTSHIFT_WP_ROOT` to its absolute path for other layouts. The public asset URL defaults to the theme's path under that root plus `/public/`. If that does not match the site's URL layout, set `publicPrefix` in `defineThemeBuild` or `EIGHTSHIFT_PUBLIC_PREFIX` in the environment to the root-relative public URL path, including its trailing slash (for example, `/wp-content/themes/example/public/`). The option takes precedence over the environment variable. The editor store ID is derived from this prefix and remains stable across rebuilds. Builds loaded together must use distinct public prefixes to avoid sharing a store. The lower-level build API does not enforce this version check.

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

4. Run `bun run build` and compare the generated assets and site behavior with the previous build. Use `bun run start` for an initial build and subsequent rebuilds, or `bun run build:sourcemaps` for external source maps. The CLI accepts `--config path` to select another configuration. By default, builds log a short start message and total elapsed seconds on success. Use `--quiet` to suppress informational output while retaining warnings and errors, or `--verbose` for build stages and theme entry/dependency details. These flags are mutually exclusive. The obsolete `--timings` flag is rejected. Both modes work with `build` and `watch`; each rebuild gets its own timer. Completion is reported only after configured SSR and publication callbacks succeed, including staged theme publication. The theme publisher may also build SSR during its publication stage. Use `eightshift-build --help` for CLI options. Programmatic `defineBuild` and theme definitions accept `{ quiet: true }` or `{ verbose: true }` in `.build()` and `.watch()`; combining them or providing the removed `timings` option throws. Custom callbacks should use the invocation context’s `quiet` and `verbose` fields to control their own informational logging. It is `eightshift-build`, not `bun build`: the library orchestrates CSS, discovery, WordPress dependencies and publication around Bun's bundler.
5. Update CI and deployment to use Bun and the new scripts. Only remove Webpack dependencies and configuration after verifying the new build. Ensure the deployment environment has access to WordPress and its compatible script metadata for dependency extraction.

The default preset discovers conventional block and component assets, builds frontend, editor and admin scripts and styles, and builds conventional SSR entries when present. SVG imports in frontend and admin scripts emit files referenced by root-relative public URLs; editor SVG imports produce SVG text instead. The default build stages intermediate assets in `.bun-pilot/theme-build`, including SSR output in `.bun-pilot/theme-build/ssr/production`, and replaces `public/` with the packaged assets and manifest only after packaging succeeds. Build or packaging failures preserve the existing public assets. Successful builds remove the staging directory. Only custom or disabled publication uses `public/.build`; the project owns its publication and cleanup. Do not keep manually maintained files in `public/`. Frontend and admin use classic-script bootstraps that dynamically import their bundled modules; the editor is packaged separately. Preserve the generated chunks alongside the entry scripts. The default preset always produces production-optimized assets, including in watch mode; watch does not provide hot reload. With `--sourcemaps`, external maps are generated for the editor entry and its lazy chunks as well as the browser bundles. SSR execution may still require Node in the project's PHP integration.

The manifest maps the conventional `applicationBlocksFrontend`, `applicationBlocksEditor` and `applicationAdmin` script and style keys to their generated files. Each entry also has `.asset.json` metadata containing WordPress dependency handles and a release version; the manifest maps its legacy `.json` key to that metadata as well. Browser entry metadata includes handles used by any emitted chunk, including lazy chunks. If Bun's build metadata is unavailable or cannot be read, the build conservatively includes all resolved handles instead; the editor also retains all resolved handles across its independently compiled chunks. **The build does not enqueue assets:** confirm that your installed PHP integration reads the generated metadata and merges its dependencies with the registered handles. Existing PHP/library versions may not support this; update or adapt them before switching, and check that the frontend, editor and admin load without missing globals. Do not assume Bun's `external` option supplies WordPress global mappings.

Successful default publication replaces the previous `public/` contents. Run only one build or publication per theme at a time; output directories are not locked against concurrent builds. The PHP manifest cache update is not coordinated with PHP cache rebuilds: if they overlap, stale asset URLs can remain until the next successful build or cache reset. Account for cached pages that may still request files removed by successful publication; retain old releases externally if needed. Verify block registration, editor controls and save/reload behavior, frontend styles and lazy assets, representative admin screens, script dependencies, browser console and asset URLs. Keep the previous Webpack build available for rollback until the new build is verified.

### Editor default and PHP compatibility

`defineThemeBuild({ root })` uses unified editor sharing: registration and lazy editor modules share one ESM graph. It requires the PHP `eightshift-editor-v1` module-readiness integration, validated with `infinum/eightshift-libs` 14.0.0-alpha.2. Install compatible PHP integration before serving these assets, and enqueue editor JavaScript through `enqueue_block_editor_assets`. The build checks WordPress source compatibility but cannot certify which PHP integration is active at runtime. Without the readiness bootstrap, the generated module throws an explicit error; there is no automatic classic-script fallback.

Classic consumers that require registered blocks must await the readiness promise described below. This is a registration-semantics change, not a guaranteed startup speedup. Package import optimization and pure JSX grouping are separate settings; JSX grouping remains off by default.

For an explicit classic-registration fallback, provide the complete editor preset:

```js
export default defineThemeBuild({
  root: import.meta.dirname,
  editor: {
    entry: 'editor',
    filename: 'applicationBlocksEditor.js',
    sharing: 'independent',
    discovery: {
      filter: /application-blocks-editor\.js$/,
      omitContexts: ({ pattern }) => ['styles-editor.css$', 'styles-editor\\.css$'].includes(pattern.source),
    },
  },
});
```

Independent entries do not preserve shared module state across separately compiled bundles: context providers and consumers spanning those bundles need an explicit compatibility solution. Rebuild and deploy matching scripts and metadata together when changing modes. Supplying `editor` replaces the whole preset; an explicit editor object without `sharing` retains the lower-level independent default.

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

For projects that prefer a validated configuration, `createPreset` and `buildPreset` are exported from `@eightshift/frontend-libs-tailwind/bun/preset.mjs`. Pass `wordpress: false`, `discovery: false`, `responsive: false` or `css: false` to disable the corresponding feature; discovery, responsive generation and CSS are opt-in. Configure CSS surfaces or pass a custom CSS callback. `buildOptions` accepts the same overrides as `build`. When an editor entry is enabled, `buildOptions.sourcemap` supports only `none` and `external`. The lower-level default `editor.sharing: 'independent'` keeps synchronous registration and lazy entries in separate bundles; the conventional theme preset instead defaults to unified sharing. Its lazy editor URLs use a build-wide query version derived from the registration and lazy bundles; changing either invalidates all lazy URLs. The opt-in sharing modes below change graph layout, and unified mode also changes registration timing.

### Native editor sharing (experimental, opt-in)

Set `editor.sharing: 'native'` to compile discovered lazy editor targets together with Bun's native ESM splitting. Registration remains a synchronous classic script. Lazy imports resolve directly to content-hashed ESM entries, without namespace facades or a custom module loader. Shared modules inside this lazy graph have one instance, shared live bindings and shared initialization; this deliberately differs from the duplicated state of independently bundled entries. The synchronous registration bundle remains separate and can still contain another instance. Different resolved package copies are not forcibly merged.

For the conventional theme preset, preserve the editor discovery configuration when overriding `editor`:

```js
import { defineThemeBuild } from '@eightshift/frontend-libs-tailwind/bun/theme-build.mjs';

export default defineThemeBuild({
  root: import.meta.dirname,
  editor: {
    entry: 'editor',
    filename: 'applicationBlocksEditor.js',
    sharing: 'native',
    discovery: {
      filter: /application-blocks-editor\.js$/,
      omitContexts: ({ pattern }) => ['styles-editor.css$', 'styles-editor\\.css$'].includes(pattern.source),
    },
  },
});
```

Native sharing preserves nested lazy imports and emits source maps when requested. The classic entry is compiled again against final chunk URLs so its source map matches. Keep every emitted entry and shared chunk together; custom publishers must preserve their URLs and worker paths. Existing watch builds regenerate the graph when their watched inputs change.

This mode requires readable Bun entry metadata and rejects dynamic imports that Bun inlines into the current chunk: those can lose native module namespaces, and dynamic self-imports were observed to generate an undefined helper in Bun 1.4.4-canary.1. These cases fail the build rather than silently falling back to different semantics. Native output must remain JavaScript and source maps, as with the existing editor pipeline.

Native sharing can substantially reduce total output while increasing the number of files requested by the editor. It does **not** guarantee faster startup or Webpack parity. Validate cold and warm editor loads, first-block rendering, options, custom plugins, worker URLs and module state before enabling it. No theme is opted into native sharing automatically. Set `sharing: 'independent'` explicitly to restore independent chunks, or remove the entire editor override to use the theme preset's unified default; rebuild and do not mix outputs from different modes.

### Unified editor graph (theme default, compatibility-changing)

`editor.sharing: 'unified'` builds registration and all lazy editor code in one native ESM graph. Unlike `native`, it can share dependency instances between registration and lazy consumers. It does **not** preserve synchronous classic-script registration. The conventional theme preset now selects this mode by default; install matching Eightshift PHP module-readiness integration and check dependent consumers before switching. Lower-level callers must still opt in explicitly.

Use the native-sharing configuration above with `sharing: 'unified'`. Do not provide `editor.lazy` rewriting options; unified mode lets Bun discover native imports. It keeps the same lazy-transform rejection rules as native mode. Its JavaScript wrapper statically imports the editor graph and signals completion through `globalThis.eightshiftEditorModules.complete(import.meta.url)`. Generated editor asset metadata declares `format: 'module'` and `readiness: 'eightshift-editor-v1'`; frontend/admin and existing editor modes retain their previous metadata. Older classic-only PHP integration is incompatible.

The shared PHP integration must establish `globalThis.eightshiftEditorModules.ready`, a map of promises keyed by the actual WordPress script handle, before emitting the parser-inserted `type="module"` entry. A dependent classic script must explicitly await its handle's promise:

```js
const handle = 'my-theme-block-editor-scripts';
const ready = globalThis.eightshiftEditorModules?.ready.get(handle);
if (!ready) {
  throw new Error(`No unified editor readiness contract for ${handle}`);
}
ready.then(() => {
  // Initial registration is complete; use the registered blocks here.
}).catch((error) => {
  console.error('Editor registration failed', error);
});
```

Readiness means the registration entry finished evaluating, not that asynchronous sidebar/plugin initialization or every lazy block has finished. A promise does not make an unmodified classic dependent wait. Readiness and registration were checked in synthetic parser-inserted module pages and one authenticated WordPress post editor, including existing content rendering and an unsaved control change followed by undo and reload. This does not certify all editors or plugins, content saving, cross-browser support or deployment behavior. Hook editor JavaScript to `enqueue_block_editor_assets`, not the content iframe's `enqueue_block_assets`; shared content styles can remain on the latter.

Do not use `async`, a dynamic-import classic bootstrap, late script insertion, or top-level await in the initial registration graph. Initial registration must complete before `DOMContentLoaded`. Matching PHP integration rejects loading errors, an evaluation failure that fires a load event without completion, and missed readiness deadlines. Third-party script optimizers, CSP rules, translations, post/site editor initialization and save/reload need explicit verification before rollout. Do not replace WordPress boot functions or `wp.domReady` to hide ordering problems.

One graph reduces duplication but is not a guarantee of fewer requests or Webpack parity. The measured prototype still loaded more startup files than Webpack. Roll back by restoring the prior editor sharing setting and matching PHP/JavaScript artifacts together; do not activate a unified artifact as a classic script.

#### Opt-in bounded pure JSX groups

In unified mode only, set `editor.pureJsxGroups: { maxBytes: 4096 }` to co-load small, proven-pure dependency definitions. The default is `false`; `maxBytes` is a required integer from 1 to 65536 and bounds the combined original UTF-8 source bytes per group, not emitted or compressed bytes. This is not a giant vendor chunk or a modulepreload workaround.

The first native build identifies single-source dependency chunks and their minimum lazy depth from the **configured initial entries**, not every output marked `entryPoint`. A restricted AST proof accepts literals, arrays/objects and intrinsic-element `jsx`/`jsxs` calls from `react/jsx-runtime`; it rejects application initialization, component calls, arbitrary calls, getters, spreads, mutation and unsupported syntax. Members share a source directory, resolved JSX runtime identity and lazy depth, have distinct export names, and are grouped deterministically within the source budget. Only pure definitions may evaluate earlier; this does not pull unrelated application initialization forward.

A second native build compiles the original graph with bounded groups. Static named dependency imports/re-exports can target a group directly; namespace, star, bare and dynamic imports retain per-module native facades. Repeated imports share the same exported element instances. This preserves Bun's existing namespace behavior, not a promise that Bun's synthesized static namespace objects equal dynamic-import namespace objects. No generated import strings are patched; Bun generates final hashes, URLs and graph metadata. Native compilation uses a private sibling staging directory and materializes only the selected pass before cleanup, including on failure. This prevents Bun versions that write despite `write: false` from publishing discarded-pass chunks. `buildEditor()` reports the grouping plan (virtual source, original members, budget, lazy depth and runtime identity) in its optional `pureJsxGroups` result.

**Conservative fallbacks:** only production builds with `buildOptions.define['process.env.NODE_ENV']` set to `'"production"'` qualify. External source maps use the original ungrouped build with a warning: synthesized group source maps are not published. Custom Bun plugins/resolvers, discovery `transformSource`, and `buildOptions.alias` also disable grouping with a warning, so custom transforms are never bypassed. Audited built-in WordPress adapters, worker handling and default discovery are supported; trusted plugin identity is checked, not merely the plugin name. Unknown graph forms, changed sources, changed runtime resolution or a non-grouped source moving to an earlier lazy depth similarly keep the first native build. Existing native inlined-dynamic-import rejection remains in force.

In an isolated production-release comparison using Bun 1.4.4-canary.1, 4 KiB grouping reduced startup theme-JavaScript requests from 34 to 16 while increasing gzip bytes from 307108 to 309447. After rendering a CTA block, requests fell from 37 to 19 and gzip bytes increased from 388459 to 390798. Both variants registered 33 theme blocks and rendered three editable CTA fields without browser errors. These measurements used a synthetic editor page with the PHP readiness bootstrap and disabled browser cache; WordPress core assets are excluded. The same-source Webpack reference used 10 startup requests / 287529 gzip bytes and 12 requests / 366641 gzip bytes after the CTA. These results do **not** establish a repeatable latency improvement or Webpack parity. Measure your own editor and lazy interactions before opting in. Remove `pureJsxGroups` or set it to `false` and rebuild to roll back; independent and native-lazy modes remain unchanged.

The earlier `editor.sharedPackages` vendor-bridge experiment was removed. Existing experimental configurations must remove that option; it now fails configuration validation rather than silently changing initialization behavior. The lower-level API retains independent mode by default; the theme preset uses unified mode with the PHP compatibility requirements above. Native sharing remains opt-in.

### Theme build and watch integration

For `defineBuild` watch configurations with `ssr` or `publish` callbacks, explicitly set `watch.sources` or `watch.ignored`. Exclude every path those callbacks write inside the project root, including paths outside the preset output directory, to avoid rebuild loops.

`defineThemeBuild` from `bun/theme-build.mjs` supplies the conventional theme layout and flat publication. `entries` replaces the complete entry map; `editor` replaces the editor preset or may be `false`. `responsive` accepts the preset's options or `false`. `css` accepts an async callback receiving `{ root, outdir, stage, responsive, require }` or `false`; `extraCss` still runs afterwards. `discovery` accepts a plugin factory receiving `{ root, setEditorWorker, getEditorWorker }` (also async) or `false`; with either override, callers must provide discovery compatible with their entry sources. `frontendStyles` applies only to default discovery. The built-in worker plugin runs before plugins returned by `createPlugins`; it resolves worker URLs for frontend, admin and editor bundles using `publicPrefix` and the selected publication layout. When used separately without a public prefix, it can use the configured editor script URL identifier. Replace it via `media.editorWorker` when custom handling is needed. The returned plugin array is not modified. `ssr` replaces `buildSsr` or can be `false`; do not specify both. `publish` replaces the flat publisher with an async callback receiving the build state, or `false` leaves the intermediate build unpublished in `public/.build`. With custom or disabled publication, the SSR callback runs after the browser build and receives the build state, `mode: 'production'`, and `outdir` pointing to `public/.build/ssr/production`.

### Shared same-origin UI Components fonts (opt-in)

Set `sharedFonts: true` in `defineThemeBuild` only after installing compatible PHP shared-font integration (`infinum/eightshift-libs` 14.0.0-alpha.3) and a UI Components release containing `dist/assets/fonts-manifest.json` (`@eightshift/ui-components` 8.5.0-beta.1). These are the first published versions containing the shared-font contract; earlier releases do not provide it. Fonts remain required: this option changes their provider, not typography. The default is `false`, preserving standalone builds.

The current shared-provider contract supports WOFF2 only and rejects other manifest formats. The build verifies UI Components font bytes against their SHA-256 manifest, extracts matching compiled top-level `@font-face` rules from the published CSS, and stages `shared-fonts.json` plus `fonts/<sha256>.<extension>` alongside other assets. Unrelated or mixed-source faces, faces nested inside rules such as `@media`, `@supports` or `@layer`, and faces in separately loaded stylesheets remain in their original stylesheets. Extraction occurs before final stylesheet hashes are calculated. The default staged publisher is required; custom publication is rejected for this option. Missing manifests, integrity mismatches or no matching faces fail the build rather than silently omitting fonts.

Compatible Eightshift PHP integration must read the generated manifest and enqueue the required font declarations with same-origin URLs shared across participating themes/plugins. Deploy PHP support and the matching assets together. Existing consumers that embed their own font faces still download their own URLs until rebuilt with this integration. Separate frames still need declarations; browser caching can reuse common URLs when enabled. No remote CDN, database cache or shared-directory write is required.

The exported `prepareSharedFonts({ root, flatDir })` helper in `bun/shared-fonts.mjs` is also available for a custom build pipeline. It mutates staged flat CSS and returns publication `extraFiles`/`aliases`; call it before hashing styles, and publish those additions atomically with the CSS. Do not run it directly on active public assets.

### Staged theme publication

Default theme builds now prepare assets outside `public`, then swap the validated
release into place. Build/package failures preserve the previous release; cache
update failures roll publication back. Custom `publish` hooks remain responsible
for their own publication and rollback.

Use `publication` to supply additional already-built files (for example Infobip
UTM scripts/fonts or Forms custom entry bundles) without replacing the publisher:

```js
import { resolve } from 'node:path';
import { defineThemeBuild } from '@eightshift/frontend-libs-tailwind/bun/theme-build.mjs';

export default defineThemeBuild({
  root: import.meta.dirname,
  publication: async ({ root }) => ({
    extraFiles: [
      { source: resolve(root, 'build/utm.js'), destination: 'utm.js' },
      { source: resolve(root, 'build/fonts'), destination: 'fonts' },
      { source: resolve(root, 'build/forms.js'), destination: 'forms.js' },
    ],
    aliases: { 'utm.js': 'utm.js', 'forms.js': 'forms.js', 'font.woff2': 'fonts/font.woff2' },
    retain: [],
  }),
});
```

Sources must exist before packaging; the hook can build them into `outdir`.
The hook may return `undefined` for no additions, or a non-array object. When
provided, `aliases` must be a non-null, non-array object and `extraFiles` must be
an array; invalid results throw a `TypeError` before packaging.
Paths are release-relative destinations; duplicate destinations fail rather than
silently overwrite. `packageFlatRelease` also accepts `extraFiles`, `retain` and
`previousPublic`. Retention is opt-in and names exact existing files, not globs or
filename heuristics. Retained files cannot collide with new outputs. Fixed names
are replaced on successful publication: they cannot preserve old browser sessions
like content-hashed filenames. Additional manifest generation and automatic
multi-release retention are not provided. Aliases join the primary manifest and
PHP asset cache; consumers needing separate manifests must use custom publication.
The lower-level `packageRelease` keeps a stylesheet's hashed output in the same
release directory as its input, preserving relative asset and `@import` URLs.
Empty stylesheets are valid and retain their manifest entries; missing stylesheets
and missing or empty JavaScript entries still fail packaging.
Its `omit` option cannot remove a JavaScript entry targeted by a generated bootstrap.

### Optimizing package imports

`optimizeImports` is an array of package names passed to Bun's [barrel import optimization](https://bun.com/docs/bundler#optimizeimports) for frontend, editor (including lazy chunks), and admin JavaScript. It also applies in watch and source-map builds, but not to SSR or CSS processing. The conventional theme build defaults to `['@eightshift/ui-components']`. Supply an array to replace the default, or `[]` to disable the preset's explicit optimization:

```js
import { defineThemeBuild } from '@eightshift/frontend-libs-tailwind/bun/theme-build.mjs';

export default defineThemeBuild({
  root: import.meta.dirname,
  optimizeImports: [], // Disable the preset's explicit package list.
});
```

To retain UI Components and add another package, set `optimizeImports: ['@eightshift/ui-components', 'another-package']`.

Bun can skip unused re-exported modules when a package is listed. The default is tested with UI Components 8.4.0; verify compatibility when using other versions. Only list additional packages after checking that skipped modules have no required JavaScript initialization side effects; verify CSS imports, WordPress dependency handles, worker assets, and affected frontend, editor, and admin screens. An empty list disables the preset's explicit list, but Bun may still optimize packages that declare `sideEffects: false`. Namespace imports, star re-exports, and mixed barrels can limit the optimization. Results vary by package and Bun version; this option was introduced in Bun 1.3.10. It does not deduplicate separate editor bundles or guarantee smaller output.

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

Frontend and admin CSS imported by JavaScript is compiled with Tailwind and loaded before the importing module executes. Styles imported by lazy modules remain unloaded until those modules are requested. Imported stylesheets that generate utilities also scan the generated frontend responsive class list when responsive generation is enabled. Direct imports already included unconditionally by the default conventional CSS compiler are not loaded twice; conditional imports and `@reference` do not suppress a separate JavaScript import. A direct import that matches a single-file keyed `extraCss` group uses the same stylesheet URL as the keyed loader; multi-file groups and CSS modules are compiled independently. Existing `frontendStyles` and other multi-file group contents are not automatically deduplicated against JavaScript imports. When a stylesheet imports CSS modules, Tailwind `@import` modifiers such as `source()`, `prefix()` and `theme()` are not supported there. Import that configured Tailwind entry separately and use `@reference`; unsupported combinations fail the build rather than producing incorrect styles.

The generated browser modules use top-level `await` and add stylesheet requests, which can affect startup or lazy-load timings. If a keyed `extraCss` load fails before its module is imported, the loader can retry; a failed JavaScript module evaluation can remain cached by the browser and may require a page reload. Custom build plugins must not bypass the theme CSS loader unless they also provide custom publication; unexpected Bun CSS output fails the build instead of being silently omitted.

The default flat publisher includes generated stylesheets in `public/` and its manifest; no alias is required for lazy loading. The output hash changes when compiled CSS changes, including rewritten asset URLs. CSS assets are copied with their own content-hashed names. Publication replaces `public/`, so cached older pages can request files no longer present; retain old releases externally if that matters. For a stable PHP manifest key, set an explicit `output` and an appropriate `aliases` entry. Custom publishers must preserve the CSS and the URL expected by the importer.

The build regenerates discovery and CSS on each rebuild. Watch monitors the configured project paths, not `node_modules` or arbitrary external files by default; customize `watch.sources` for additional inputs. Default theme builds use production CSS processing, including Lightning CSS minification and its browser targets, even in watch mode. `extraCss` may also be an async hook receiving `{ root, stage, require }`, or `false` to disable it. Hooks are responsible for their own filenames and loading behavior. `frontendStyles` separately attaches existing URLs to keys; both automatic mechanisms require default discovery.

Default flat publication requires frontend, admin and editor entries, an editor build, and CSS at the conventional filenames. It scans the conventional SSR source glob and expects matching outputs in `.bun-pilot/theme-build/ssr/production`. With default publication, custom `ssr` (or legacy `buildSsr`) callbacks receive `{ root, mode: 'production', outdir }`, where `outdir` is the absolute path to that SSR output directory. Callbacks must finish writing `<name>.js` files there before resolving, where `<name>` is the directory containing each conventional `assets-ssr` directory; `packageFlatRelease` reads those files from the same directory. Use `ssr: false` to omit SSR or supply custom publication for a different layout. Disabling responsive generation requires custom or disabled CSS. Custom publication is required when disabling CSS or the editor, or changing the entry set. With custom or disabled publication, intermediate output remains in `public/.build`; the project owns its publication and cleanup.

The default SSR builder compiles all discovered entries together into standalone Node CJS bundles, without shared chunks or sourcemaps. Output filenames remain `<block-or-component-directory>.js`; duplicate names are rejected before compilation. Caller-supplied plugins retain one sequential compilation per entry to preserve their per-build lifecycle. Compilation omits Bun's `outdir` so it stays in memory (Bun 1.4.4 can write files when `outdir` is set even with `write: false`). All outputs are validated before explicit writes; compilation failures leave existing files untouched. Returned `outputs[].path` is the publication path, while `outputs[].output.path` is Bun's intermediate artifact path. `write: false` never creates the output directory. The low-level builder does not prune old files when entries are removed; the theme preset rebuilds its owned staging directory. Writes are sequential, not an atomic transaction for I/O failures. Multi-entry compilation can retain additional dependency definitions and change bundle bytes; it does not guarantee byte identity with separate compilations.

Externalized `@wordpress/*` browser imports do not require matching JavaScript packages in the theme or plugin. Their exports and default-global mappings come from the target WordPress installation. Packages deliberately bundled by the adapter, and packages used by SSR or builds with `wordpress: false`, still need to be installed. React, React DOM and `lodash-es` also retain their installed-package export-discovery requirements.

WordPress externalization is enabled by default. Set `wpRoot` to the WordPress installation when using externalized `@wordpress/*` imports; export discovery reads its core scripts without requiring installed package metadata. WordPress scripts without an export table are treated as side-effect-only dependencies: no exported global is required, and their handles are retained even when Bun erases the empty adapter. Resolved side-effect-only handles are retained conservatively, including when their importing code is later tree-shaken. The adapter also maps React and selected common dependencies to WordPress globals. Those globals and script handles must be available at runtime. Set `wordpress: false` to disable this adapter. For direct Bun integration, `wordpressPlugin({ projectRoot, wpRoot })` returns `{ plugin, dependencies, getEmittedDependencies }`; use a fresh adapter for each build and absolute paths. `dependencies` contains all resolved handles. Request a Bun metafile and pass it to `getEmittedDependencies(metafile)` to derive handles from every emitted output; invalid metadata falls back to all resolved handles. Some Bun versions can throw when reading `result.metafile` itself, so catch that access and fall back to `dependencies` too.

`processCss` compiles the `files` array in order into one output file. Each item is a path or `{ file, content, scan, sources, scanFiles, removeSources }`: optional `content` replaces the source text while `file` remains the base for imports; scanning is opt-in; `scan: 'auto'` scans only when the stylesheet requests utility generation; `sources` adds Tailwind scanner source objects, `scanFiles` adds explicit candidate files even when those paths are excluded from automatic scanning, and `removeSources` removes exact source-rule strings (and fails if absent). Relative paths resolve from `projectDir`. Local URL assets, including string URLs in `image-set()` and `-webkit-image-set()`, are copied next to the CSS with content-hashed names. Production uses Lightning CSS and the `browsers` option (default `>= 0.25%`); the return value includes `outputFile` and discovered `dependencies`. Watch does not automatically use those dependencies. `responsive: {}` generates frontend and editor class lists from `src/**/manifest.json`, expanding responsive classes for `sm` and `md`; customize `breakpoints`, `manifestGlob`, and `output`. Pass the relevant generated list to CSS scanning, as above. The standalone `generateResponsiveClasses({ projectDir, ... })` is also exported from `bun/build.mjs`.

The editor discovery transforms match parsed JavaScript call expressions, not comments, string contents or JSX text. Generated context bindings avoid identifiers already present in the source. Unsupported executable `require.context` arguments still fail the build.

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

### CLI watch process restarts

`eightshift-build watch` keeps ordinary source watching in the configured watcher.
It polls the selected config file and the working directory's `package.json`,
`bun.lock`, and `bun.lockb` for content changes (100 ms polling, 200 ms settling),
then drains the old worker before importing configuration in a fresh Bun process.
Missing files and atomic replacements are detected. Invalid configuration prints
its error and waits for another restart-input change instead of respawning in a loop.
A worker failure remains reflected in the supervisor's eventual exit status.

This is an explicit boundary, not dependency discovery. Nested dependency manifests,
installed library edits, imported config helpers, other lockfiles and environment
changes require manually stopping and starting the CLI. In particular, editing a
nested package's exports alone does not trigger a restart; changing a root restart
input afterward loads it fresh. Install transactions should finish before restarting.
Programmatic `defineBuild`/`watchBuild` behavior and custom watch options are unchanged.

SIGINT/SIGTERM request shutdown even during configuration loading. Interrupted
one-shot builds exit nonzero, including when stopped before the build begins.
The CLI waits
for config loading and the watcher's `stop()` promise; it never force-kills a slow
build or launches a concurrent replacement. A hung import or callback can therefore
hold shutdown indefinitely. Custom watchers must stop scheduling and drain all
work in `stop()`. Custom SSR/publication callbacks remain responsible for their own
transactional guarantees: process serialization does not provide rollback across
browser assets, SSR and custom publication. Reported build errors retain the
configured watcher's existing reporting/recovery behavior.

### Structured publication (only built-in layout; breaking change)

Conventional `defineThemeBuild` publication retains compiler surface subdirectories
(`frontend/`, `admin/`, `editor/`, `css/`). Public manifest keys remain stable, but
their target URLs change. Consumers must resolve assets through the manifest rather
than assuming root-level filenames. The `publicationLayout` option has been removed:
remove it even when its value was `'structured'`. Explicit use is rejected rather
than silently ignored. The legacy `flattenAssets` implementation/export is removed.

Migrate `publication` hooks to use the provided `publicationRoot` for the prepared
public tree, not `resolve(outdir, 'flat')`. This is a stable directory contract:
the directory contains the collected nested outputs before packaging, and aliases
are relative to it. Its absolute path is staging-only; do not persist it or depend
on its basename. Enumerate nested files when needed and include their directory
names in aliases. `outdir` remains the compiler staging directory. Fixed UTM/player
outputs remain supported through `extraFiles: [{ source, destination }]` and aliases
mapping public manifest keys to those destinations.

Custom `publish` functions and `publish: false` remain supported and own publication,
but theme compiler URLs now always target structured surface directories. Custom
publishers must preserve those paths or explicitly implement their own relocation.
A `publication` hook is preferred for extending the built-in publisher. Low-level
`defineBuild`, `packageRelease` and `packageFlatRelease` remain layout-neutral and
keep their existing defaults. Despite their historical names, `packageFlatRelease`
and `publishFlatRelease` in `bun/flat-publication.mjs` operate on prepared trees,
including nested files; their API is retained for existing custom publishers.

Structured conventional CSS omits unreferenced stable entry styles only after the
same-directory hashed stylesheet and manifest are generated. Alias targets and
references in packaged files or generated wrappers retain the stable stylesheet;
queries, fragments and escaped names are considered conservatively. Custom `css`
callbacks retain their entry styles. Hooks that construct CSS URLs dynamically
must pin the stable path with an alias; static inspection cannot certify computed
URLs. Extra styles, script intermediates and source maps are not blanket-removed.
Low-level packagers can opt into this scoped behavior with
`removeUnreferencedStyles: true`; this is not a general unused-asset collector.

This default does not change cache synchronization, retention, rollback policy,
or active site configuration. Reverting to explicit `'flat'` rebuilds the old
layout; keep the previous complete release when deploying or rolling back.
Low-level builds and presets optionally accept `entryPublicPaths`, an object mapping
existing entry names to root-relative public URL prefixes ending in `/`. Omitted
entries continue using `buildOptions.publicPath`; editor output keeps its editor
builder URL contract. Shared fonts support nested stylesheet paths.

Local CSS asset URL pathnames are percent-decoded once before filesystem resolution.
Query strings and fragments are preserved on published URLs. Encode literal `%`
characters as `%25`; malformed pathname encoding fails with an explicit error.
Remote URLs are left unchanged.

## Source formatting

Run `bun run lintJs bun bin linters scripts eslint.config.mjs` to check maintained
JavaScript sources. Add `--fix --fix-type layout,suggestion` to apply formatting
fixes. The repository configuration requires braces for control-flow statements,
blank lines before control flow and returns, and separation after blocks. These
rules also cover `.mjs` build helpers. Tests, packaged output, dependencies and
compiled output are excluded; the published consumer lint configuration is unchanged.
