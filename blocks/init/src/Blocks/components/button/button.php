<?php

/**
 * Button component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$buttonUse = Helpers::checkAttr('buttonUse', $attributes, $manifest);

if (!$buttonUse) {
	return;
}

$additionalClass = $attributes['additionalClass'] ?? '';
$additionalAttributes = $attributes['additionalAttributes'] ?? [];
$buttonId = Helpers::checkAttr('buttonId', $attributes, $manifest);

$buttonUrl = Helpers::checkAttr('buttonUrl', $attributes, $manifest);
$buttonIsNewTab = Helpers::checkAttr('buttonIsNewTab', $attributes, $manifest);

$buttonContent = Helpers::checkAttr('buttonContent', $attributes, $manifest);

$buttonAriaLabel = Helpers::checkAttr('buttonAriaLabel', $attributes, $manifest);

$buttonIconUse = Helpers::checkAttr('buttonIconUse', $attributes, $manifest);

$buttonAttrs = [];

if (!$buttonIconUse && empty($buttonContent)) {
	return;
}

if (!empty($additionalAttributes)) {
	$buttonAttrs = $additionalAttributes;
}

if (!empty($buttonUrl)) {
	$buttonAttrs['href'] = $buttonUrl;
}

if ($buttonIsNewTab) {
	$buttonAttrs['target'] = '_blank';
	$buttonAttrs['rel'] = 'noopener noreferrer';
}

if (!empty($buttonId)) {
	$buttonAttrs['id'] = $buttonId;
}

if (!empty($buttonAriaLabel)) {
	$buttonAttrs['aria-label'] = $buttonAriaLabel;
}

$buttonAttrs['class'] = Helpers::tailwindClasses('base', $attributes, $manifest, 'button', $additionalClass);

$buttonTag = !empty($buttonUrl) ? 'a' : 'button';
?>

<<?php echo $buttonTag; // phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped ?>
	<?php
	foreach ($buttonAttrs as $key => $value) {
		if (empty($key) && empty($value)) {
			continue;
		}

		// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
		echo "{$key}=" . '"' . esc_attr($value) . '"';
	}
	?>
>
	<?php
	echo Helpers::render('icon', Helpers::props('icon', $attributes));
	?>

	<?php if (!empty($buttonContent)) { ?>
		<span><?php echo esc_html($buttonContent); ?></span>
	<?php } ?>
</<?php echo $buttonTag; // phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped ?>>
