<?php

/**
 * Template for the Wrapper block.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$wrapperUse = Helpers::checkAttr('wrapperUse', $attributes, $manifest);

if (!$wrapperUse) {
	// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
	echo $renderContent;
	return;
}

$wrapperTag = Helpers::checkAttr('wrapperTag', $attributes, $manifest);
$wrapperId = Helpers::checkAttr('wrapperId', $attributes, $manifest);
?>

<<?php echo esc_attr($wrapperTag); ?>
	class="<?php echo esc_attr(Helpers::getTwClasses($attributes, $manifest)); ?>"
	<?php if (!empty($wrapperId)) { ?>
		id="<?php echo esc_attr($wrapperId); ?>"
	<?php } ?>
>
	<?php
	// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
	echo $renderContent;
	?>
</<?php echo esc_attr($wrapperTag); ?>>
