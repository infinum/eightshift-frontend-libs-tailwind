/**
 * Main entry point for scripts used in the WordPress admin.
 */

import { dynamicImport } from '@eightshift/frontend-libs-tailwind/scripts/helpers';

dynamicImport(require.context('./../../src/Blocks/components', true, /assets-admin\/index\.js$/));
