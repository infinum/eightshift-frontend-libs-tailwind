<?php

/**
 * Wrapper block template.
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

$wrapperId = Helpers::checkAttr('wrapperId', $attributes, $manifest);
?>

<div
	class="<?php echo esc_attr(Helpers::tailwindClasses('base', $attributes, $manifest)); ?>"
	<?php if (!empty($wrapperId)) { ?>
		id="<?php echo esc_attr($wrapperId); ?>"
	<?php } ?>
>
	<?php
	// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
	echo $renderContent;
	?>
</div>
