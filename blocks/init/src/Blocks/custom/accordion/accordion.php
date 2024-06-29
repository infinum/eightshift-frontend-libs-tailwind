<?php

/**
 * Accordion block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$blockJsClass = $attributes['blockJsClass'] ?? '';

$accordionCloseAdjacent = Helpers::checkAttr('accordionCloseAdjacent', $attributes, $manifest);
?>

<div
	class="<?php echo esc_attr($blockJsClass); ?>"
	<?php if ($accordionCloseAdjacent) {
		?> data-close-adjacent <?php
	} ?>
>
	<?php
	// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
	echo $renderContent;
	?>
</div>
