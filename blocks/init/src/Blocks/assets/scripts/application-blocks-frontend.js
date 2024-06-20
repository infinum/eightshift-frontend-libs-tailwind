/**
 * Main entry point for scripts used in the site frontend.
 *
 * To make sure scripts are included, an `index.js` file must be present at `src/blocks/custom/<block-name>/assets/`.
 */

import { dynamicImport } from '@eightshift/frontend-libs-tailwind/scripts/helpers';

// Find all blocks and require assets index.js inside it.
dynamicImport(require.context('./../../components', true, /assets\/index\.js$/));
dynamicImport(require.context('./../../custom', true, /assets\/index\.js$/));

// Output all styles.
dynamicImport(require.context('./../../components', true, /styles.css$/));
dynamicImport(require.context('./../../custom', true, /styles.css$/));
dynamicImport(require.context('./../../wrapper', true, /styles.css$/));

// Output all frontend-only styles.
dynamicImport(require.context('./../../components', true, /styles-frontend.css$/));
dynamicImport(require.context('./../../custom', true, /styles-frontend.css$/));
dynamicImport(require.context('./../../wrapper', true, /styles-frontend.css$/));
