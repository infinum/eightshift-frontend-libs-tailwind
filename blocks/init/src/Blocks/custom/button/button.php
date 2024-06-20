<?php

/**
 * Template for the Button Block view.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

echo Helpers::render('button', Helpers::props('button', $attributes));
