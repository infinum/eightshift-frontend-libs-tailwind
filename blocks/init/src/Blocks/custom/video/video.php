<?php

/**
 * Video block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$blockClass = $attributes['blockClass'] ?? '';


?>

<div class="<?php echo esc_attr($blockClass); ?>" >
	<?php
	echo Helpers::render('video', Helpers::props('video', $attributes));
	?>
</div>
