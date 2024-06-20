<?php

/**
 * Hero block view template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

echo Helpers::render('hero', Helpers::props('hero', $attributes));
