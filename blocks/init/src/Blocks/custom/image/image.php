<?php

/**
 * Template for the Image Block view.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

echo Helpers::render('image', Helpers::props('image', $attributes));
