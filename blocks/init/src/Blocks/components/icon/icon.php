<?php

/**
 * Icon component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$iconUse = Helpers::checkAttr('iconUse', $attributes, $manifest);

if (!$iconUse) {
	return;
}

$additionalClass = $attributes['additionalClass'] ?? '';

$iconName = Helpers::checkAttr('iconName', $attributes, $manifest);
$iconAriaHidden = Helpers::checkAttr('iconAriaHidden', $attributes, $manifest);

if (!isset($manifest['icons'][$iconName])) {
	return;
}

$icon = $manifest['icons'][$iconName];

$className = Helpers::tailwindClasses('base', $attributes, $manifest, $additionalClass);

if (!empty($className)) {
	$icon = str_replace('<svg ', '<svg class="' . esc_attr($className) . '" ', $icon);
}

if ($iconAriaHidden) {
	$icon = str_replace('<svg ', '<svg aria-hidden="true" ', $icon);
} else {
	$iconTitle = '';
	$iconOption = array_filter($manifest['options']['iconName'], fn($option) => $option['value'] === $iconName);

	if (!empty($iconOption)) {
		$iconTitle = reset($iconOption)['label'];
	}

	if (!empty($iconTitle)) {
		$titleTag = '<title>' . esc_html($iconTitle) . '</title>';
		$icon = str_replace('</svg>', $titleTag . '</svg>', $icon);
	}
}

// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
echo $icon;
