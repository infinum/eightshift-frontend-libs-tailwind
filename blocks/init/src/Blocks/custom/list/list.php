<?php

/**
 * List block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

echo Helpers::render('list', Helpers::props('list', $attributes, [
	'additionalClass' => Helpers::getTwClasses($attributes, $manifest),
]));
