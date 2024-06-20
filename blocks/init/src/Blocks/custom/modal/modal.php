<?php

/**
 * Template for the Group block.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$modalId = Helpers::checkAttr('modalId', $attributes, $manifest);
$modalTitle = Helpers::checkAttr('modalTitle', $attributes, $manifest);

echo Helpers::render('modal', [
	'modalId' => $modalId,
	'modalTitle' => $modalTitle,
	'modalContent' => $renderContent,
]);
