<?php

/**
 * Columns block template..
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$blockClass = Helpers::getTwClasses($attributes, $manifest);
?>

<div class="<?php echo esc_attr($blockClass); ?>" >
	<?php
	// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
	echo $renderContent;
	?>
</div>
