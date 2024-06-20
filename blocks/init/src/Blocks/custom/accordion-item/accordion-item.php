<?php

/**
 * Accordion item block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$blockJsClass = $attributes['blockJsClass'] ?? '';

$uniqueId = Helpers::getUnique();

$panelId = "{$uniqueId}-panel";
$triggerId = "{$uniqueId}-header";

$accordionItemLabel = Helpers::checkAttr('accordionItemLabel', $attributes, $manifest);
?>

<button
	id="<?php echo esc_attr($triggerId); ?>"
	aria-expanded="false"
	aria-controls="<?php echo esc_attr($panelId); ?>"
	class="<?php echo esc_attr(Helpers::getTwPart('trigger', $manifest)); ?>"
	data-accordion-header
>
	<?php
	echo esc_attr($accordionItemLabel),
	// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
	$manifest['resources']['icon'];
	?>
</button>
<section
	id="<?php echo esc_attr($panelId); ?>"
	aria-labelledby="<?php echo esc_attr($triggerId); ?>"
	class="<?php echo esc_attr(Helpers::getTwPart('content-container', $manifest)); ?>"
	hidden
>
	<?php
		// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
		echo $renderContent;
	?>
</section>
