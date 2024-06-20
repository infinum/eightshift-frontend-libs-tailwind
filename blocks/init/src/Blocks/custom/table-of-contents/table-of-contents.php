<?php

/**
 * Template for the Table of contents block.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$blockClass = $attributes['blockClass'] ?? '';
$blockJsClass = $attributes['blockJsClass'] ?? '';

$tocClass = Helpers::classnames([
	Helpers::getTwPart('container', $manifest),
	$blockJsClass,
]);

$tableOfContentsHeadingLevels = Helpers::checkAttr('tableOfContentsHeadingLevels', $attributes, $manifest);
$tableOfContentsDescription = Helpers::checkAttr('tableOfContentsDescription', $attributes, $manifest);

$headingLevelsToUse = implode(',', array_keys(array_filter($tableOfContentsHeadingLevels, fn($v) => $v)));
?>

<div class="<?php echo esc_attr($tocClass); ?>" data-levels="<?php echo esc_attr($headingLevelsToUse); ?>">
	<p class="<?php echo esc_attr(Helpers::getTwPart('description', $manifest)); ?>">
	<?php echo esc_attr($tableOfContentsDescription); ?>
	</p>
</div>
