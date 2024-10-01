<?php

/**
 * Heading component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$headingUse = Helpers::checkAttr('headingUse', $attributes, $manifest);

if (!$headingUse) {
	return;
}

$additionalClass = $attributes['additionalClass'] ?? '';

$headingContent = Helpers::checkAttr('headingContent', $attributes, $manifest);
$headingTag = Helpers::checkAttr('headingTag', $attributes, $manifest);

if (!$headingContent) {
	return;
}

$sanitizedTitle = '';

if (function_exists('idn_to_ascii') && function_exists('sanitize_title')) {
	$sanitizedTitle = sanitize_title(idn_to_ascii($headingContent));
} else {
	$sanitizedTitle = sanitize_title($headingContent);
}
?>

<<?php echo esc_attr($headingTag); ?>
	data-slug="<?php echo esc_attr($sanitizedTitle) ?>"
	class="<?php echo esc_attr(Helpers::tailwindClasses('base', $attributes, $manifest, $additionalClass)); ?>"
>
	<?php
		// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
		echo $headingContent;
	?>
</<?php echo esc_attr($headingTag); ?>>
