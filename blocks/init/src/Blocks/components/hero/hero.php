<?php

/**
 * Template for the Hero Component.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$heroUse = Helpers::checkAttr('heroUse', $attributes, $manifest);

if (!$heroUse) {
	return;
}

$additionalClass = $attributes['additionalClass'] ?? '';
?>

<section class="<?php echo esc_attr(Helpers::getTwClasses($attributes, $manifest, $additionalClass)); ?>">
	<?php
	echo Helpers::render('image', Helpers::props('image', $attributes, [
		'additionalClass' => [
			'image' => 'size-full grayscale',
			'picture' => Helpers::getTwPart('imagePicture', $manifest),
		],
	]));
	?>

	<?php
	echo Helpers::render('heading', Helpers::props('heading', $attributes)),
	Helpers::render('paragraph', Helpers::props('paragraph', $attributes, [
		'additionalClass' => 'mt-4 max-w-96 text-pretty',
	]));
	?>

	<div class="flex gap-2 mt-6">
		<?php
		echo Helpers::render('button', Helpers::props('buttonMain', $attributes)),
		Helpers::render('button', Helpers::props('buttonSecondary', $attributes));
		?>
	</div>
</section>
