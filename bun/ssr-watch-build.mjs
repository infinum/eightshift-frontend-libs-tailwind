import { buildSsr } from './ssr.mjs';

// A fresh process prevents Bun's resolver cache from retaining old package maps.
const result = await buildSsr({ ...JSON.parse(process.argv[2]), write: false, collectDependencies: true });
const outputs = await Promise.all(result.outputs.map(async ({ name, entrypoint, output }) => ({ name, entrypoint, bytes: Buffer.from(await output.arrayBuffer()).toString('base64') })));
console.log(JSON.stringify({ dependencies: result.dependencies, cacheable: result.cacheable, outputs }));
