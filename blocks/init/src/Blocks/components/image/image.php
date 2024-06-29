<?php

/**
 * Image component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$globalManifest = Helpers::getSettings();
$manifest = Helpers::getManifestByDir(__DIR__);

$additionalClass = $attributes['additionalClass'] ?? '';

$imageUse = Helpers::checkAttr('imageUse', $attributes, $manifest) ?? false;
$imageData = Helpers::checkAttr('imageData', $attributes, $manifest);

if (!$imageUse || empty($imageData['_default']['url'])) {
	return;
}

$imageAlt = get_post_meta($imageData['_default']['id'], '_wp_attachment_image_alt', true) ?? '';

$isMobileFirst = $imageData['_desktopFirst'] ?? false;

$breakpointData = Helpers::getSettingsGlobalVariablesBreakpoints();
$breakpoints = Helpers::getTwBreakpoints($isMobileFirst);
?>

<picture
	<?php if (!empty($additionalClass['picture'])) { ?>
		class="<?php echo esc_attr($additionalClass['picture']); ?>"
	<?php } ?>
>
	<?php foreach ($breakpoints as $breakpoint) { ?>
		<?php
		if (!isset($imageData[$breakpoint])) {
			continue;
		}

		$value = $imageData[$breakpoint]['url'] ?? '';

		if (empty($value)) {
			continue;
		}

		$breakpointWidth = $breakpointData[str_replace('max-', '', $breakpoint)];

		$widthMode = $isMobileFirst ? 'min-width' : 'max-width';

		// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
		echo '<source srcset="' . esc_url($value) . '" media="(' . $widthMode . ': ' . $breakpointWidth . 'rem)" />';
		?>
	<?php } ?>

	<img
		src="<?php echo esc_url($imageData['_default']['url'] ?? ''); ?>"
		alt="<?php echo esc_attr($imageAlt); ?>"
		class="<?php echo esc_attr(Helpers::getTwClasses($attributes, $manifest, $additionalClass['image'] ?? $additionalClass)); ?>"
	/>
</picture>
