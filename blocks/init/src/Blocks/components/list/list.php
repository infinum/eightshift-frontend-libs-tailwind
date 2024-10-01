<?php

/**
 * List component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$listUse = Helpers::checkAttr('listUse', $attributes, $manifest);

if (!$listUse) {
	return;
}

$additionalClass = $attributes['additionalClass'] ?? '';

$listContent = Helpers::checkAttr('listContent', $attributes, $manifest);
$listType = Helpers::checkAttr('listType', $attributes, $manifest);
?>

<<?php echo esc_attr($listType); ?>
	class="<?php echo esc_attr(Helpers::tailwindClasses('base', $attributes, $manifest, $additionalClass)); ?>"
>
	<?php
	// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
	echo $listContent;
	?>
</<?php echo esc_attr($listType); ?>>
