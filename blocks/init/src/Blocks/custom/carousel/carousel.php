<?php

/**
 * Carousel block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$blockJsClass = $manifest['blockJsClass'] ?? $attributes['blockJsClass'] ?? '';

$carouselLoop = Helpers::checkAttr('carouselLoop', $attributes, $manifest);
$carouselNavigation = Helpers::checkAttr('carouselNavigation', $attributes, $manifest);
$carouselPagination = Helpers::checkAttr('carouselPagination', $attributes, $manifest);
?>

<div
	class="<?php echo esc_attr($blockJsClass); ?>"
	<?php if ($carouselLoop) { ?>
		data-loop
	<?php } ?>
>
	<?php if ($carouselNavigation || $carouselPagination) { ?>
		<div class="hidden sm:flex items-center justify-center gap-2 mb-4">
			<?php if ($carouselPagination) { ?>
				<div class="<?php echo esc_attr(Helpers::classnames(["{$blockJsClass}-pagination", $carouselNavigation ? 'mr-auto' : '', 'max-sm:hidden space-x-0.5'])); ?>"></div>
			<?php } ?>

			<?php
			if ($carouselNavigation) {
				echo Helpers::render('button', [
					'iconName' => 'back-arrow',
					'buttonSize' => 'square',
					'buttonVariant' => 'primary',
					'buttonColor' => 'navy-800',
					'additionalClass' => "{$blockJsClass}-prev",
				]),
				Helpers::render('button', [
					'iconName' => 'forward-arrow',
					'buttonSize' => 'square',
					'buttonVariant' => 'primary',
					'buttonColor' => 'navy-800',
					'additionalClass' => "{$blockJsClass}-next",
				]);
			}
			?>
		</div>
	<?php } ?>

	<div class="<?php echo esc_attr(Helpers::getTwPart('container', $manifest, "{$blockJsClass}-container")); ?>">
		<div class="<?php echo esc_attr(Helpers::getTwClasses($attributes, $manifest)); ?>">
			<?php
			// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
			echo $renderContent;
			?>
		</div>
	</div>
</div>
