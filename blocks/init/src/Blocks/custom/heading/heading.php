<?php

/**
 * Heading block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

echo Helpers::render('heading', Helpers::props('heading', $attributes, [
	'additionalClass' => Helpers::tailwindClasses('base', $attributes, $manifest),
]));
