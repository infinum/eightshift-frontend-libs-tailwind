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

<div class="<?php echo esc_attr(Helpers::getTwClasses($attributes, $manifest, $additionalClass)); ?>" >
	<?php
	echo Helpers::render('image', Helpers::props('image', $attributes, [
		'additionalClass' => [
			'image' => Helpers::getTwPart('image', $manifest),
			'picture' => Helpers::getTwPart('imagePicture', $manifest),
		]
	]));
	?>

	<div class="<?php echo esc_attr(Helpers::getTwPart('content-container', $manifest)); ?>">
		<?php
		echo Helpers::render('paragraph', Helpers::props('intro', $attributes, [
			'additionalClass' => Helpers::getTwPart('intro', $manifest),
		])),

		Helpers::render('heading', Helpers::props('heading', $attributes)),

		Helpers::render('paragraph', Helpers::props('paragraph', $attributes, [
			'additionalClass' => Helpers::getTwPart('text', $manifest),
		])),

		Helpers::render('button', Helpers::props('button', $attributes, [
			'additionalClass' => Helpers::getTwPart('button', $manifest),
		]));
		?>
	</div>
</div>
