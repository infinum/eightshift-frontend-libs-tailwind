<?php

/**
 * Image block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

echo Helpers::render('image', Helpers::props('image', $attributes, [
	'additionalClass' => Helpers::tailwindClasses('base', $attributes, $manifest),
]));
