<?php

/**
 * Quote component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);
$additionalClass = $attributes['additionalClass'] ?? '';

$quoteUse = Helpers::checkAttr('quoteUse', $attributes, $manifest);

if (!$quoteUse) {
	return;
}

$quoteText = Helpers::checkAttr('quoteText', $attributes, $manifest);
$quoteAuthor = Helpers::checkAttr('quoteAuthor', $attributes, $manifest);
$quoteShowIcon = Helpers::checkAttr('quoteShowIcon', $attributes, $manifest);

$iconClass = Helpers::tailwindClasses('icon', $attributes, $manifest);

$icon = $manifest['resources']['quoteIcon'];
$icon = str_replace('<svg', '<svg class="' . $iconClass . '"', $icon);
$icon = str_replace('<svg', '<svg aria-hidden="true"', $icon);
?>

<figure class="<?php echo esc_attr(Helpers::tailwindClasses('container', $attributes, $manifest, $additionalClass)); ?>">
	<?php
	if ($quoteShowIcon) {
		// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
		echo $icon;
	}
	?>

	<blockquote class="<?php echo esc_attr(Helpers::tailwindClasses('quote-text', $attributes, $manifest)); ?>">
		<?php echo wp_kses_post($quoteText); ?>
	</blockquote>

	<?php if (!empty($quoteAuthor)) { ?>
		<figcaption class="<?php echo esc_attr(Helpers::tailwindClasses('author', $attributes, $manifest)); ?>">
			&mdash;
			<?php echo wp_kses_post($quoteAuthor); ?>
		</figcaption>
	<?php } ?>
</figure>
