<?php

/**
 * Paragraph block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

echo Helpers::render('paragraph', Helpers::props('paragraph', $attributes, [
	'additionalClass' => Helpers::getTwClasses($attributes, $manifest),
]));
