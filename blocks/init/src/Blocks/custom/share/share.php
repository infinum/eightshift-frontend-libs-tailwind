<?php

/**
 * Template for the Share block.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

echo Helpers::render('share', Helpers::props('share', $attributes));
