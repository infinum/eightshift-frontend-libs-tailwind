<?php

/**
 * 'Load more' button component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);
$componentName = $attributes['componentName'] ?? $manifest['componentName'];

$loadMoreUse = Helpers::checkAttr('loadMoreUse', $attributes, $manifest, $componentName);
if (!$loadMoreUse) {
	return;
}

$componentJsClass = $manifest['componentJsClass'] ?? '';
$additionalClass = $attributes['additionalClass'] ?? '';

$loadMoreInitialItems = Helpers::checkAttr('loadMoreInitialItems', $attributes, $manifest, $componentName);
$loadMoreQuery = Helpers::checkAttr('loadMoreQuery', $attributes, $manifest, $componentName);
$loadMoreId = Helpers::checkAttr('loadMoreId', $attributes, $manifest, $componentName);
$loadMoreType = Helpers::checkAttr('loadMoreType', $attributes, $manifest, $componentName);
$loadMorePerPageOverride = Helpers::checkAttr('loadMorePerPageOverride', $attributes, $manifest, $componentName);
$loadMorePage = Helpers::checkAttr('loadMorePage', $attributes, $manifest, $componentName);

// Bailout if no query is provided.
if (!$loadMoreQuery) {
	return;
}

$baseAttrs = Helpers::props('button', $attributes, [
	'additionalClass' => $componentJsClass . ' ' . $additionalClass,
]);

echo Helpers::render('button', array_merge($baseAttrs, [
	'additionalAttributes' => [
		'data-load-more-type' => $loadMoreType,
		'data-load-more-id' => $loadMoreId,
		'data-load-more-query' => $loadMoreQuery,
		'data-load-more-initial-items' => $loadMoreInitialItems,
		'data-load-more-per-page-override' => $loadMorePerPageOverride,
		'data-load-more-page' => $loadMorePage,
	],
]));
