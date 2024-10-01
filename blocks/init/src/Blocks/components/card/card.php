<?php

/**
 * Card component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);
$additionalClass = $attributes['additionalClass'] ?? '';
?>

<div class="<?php echo esc_attr(Helpers::tailwindClasses('base', $attributes, $manifest, $additionalClass)); ?>" >
	<?php
	echo Helpers::render('image', Helpers::props('image', $attributes, [
		'additionalClass' => [
			'image' => Helpers::tailwindClasses('image', $attributes, $manifest),
			'picture' => Helpers::tailwindClasses('imagePicture', $attributes, $manifest),
		]
	]));
	?>

	<div class="<?php echo esc_attr(Helpers::tailwindClasses('content-container', $attributes, $manifest)); ?>">
		<?php
		echo Helpers::render('paragraph', Helpers::props('intro', $attributes, [
			'additionalClass' => Helpers::tailwindClasses('intro', $attributes, $manifest),
		])),

		Helpers::render('heading', Helpers::props('heading', $attributes)),

		Helpers::render('paragraph', Helpers::props('paragraph', $attributes, [
			'additionalClass' => Helpers::tailwindClasses('text', $attributes, $manifest),
		])),

		Helpers::render('button', Helpers::props('button', $attributes, [
			'additionalClass' => Helpers::tailwindClasses('button', $attributes, $manifest),
		]));
		?>
	</div>
</div>
