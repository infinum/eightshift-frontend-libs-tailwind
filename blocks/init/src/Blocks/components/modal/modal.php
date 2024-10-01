<?php

/**
 * Modal component template.
 *
 * @package %g_namespace%.
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$componentJsClass = $manifest['componentJsClass'] ?? '';
$additionalClass = $attributes['additionalClass'] ?? '';

$modalId = Helpers::checkAttr('modalId', $attributes, $manifest);
$modalTitle = Helpers::checkAttr('modalTitle', $attributes, $manifest);
$modalContent = Helpers::checkAttr('modalContent', $attributes, $manifest);
?>

<div id="<?php echo esc_attr($modalId); ?>" aria-hidden="true" class="<?php echo esc_attr(Helpers::tailwindClasses('modalWrapper', $attributes, $manifest, $componentJsClass)); ?>">
	<div tabindex="-1" class="<?php echo esc_attr(Helpers::tailwindClasses('modalBackdrop', $attributes, $manifest)); ?>" data-micromodal-close>
		<div class="<?php echo esc_attr(Helpers::tailwindClasses('modalContent', $attributes, $manifest)); ?>" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr($modalId); ?>-title">
			<header class="<?php echo esc_attr(Helpers::tailwindClasses('modalHeader', $attributes, $manifest)); ?>">
				<?php if (!empty($modalTitle)) { ?>
					<p id="<?php echo esc_attr($modalId); ?>-title">
						<?php echo esc_html($modalTitle); ?>
					</p>
				<?php } ?>

				<button class="<?php echo esc_attr(Helpers::tailwindClasses('button', $attributes, $manifest, 'ml-auto')); ?>" aria-label="Close menu" data-micromodal-close>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</header>

			<div id="<?php echo esc_attr($modalId); ?>-content" class="grow">
				<?php
				// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
				echo $modalContent;
				?>
			</div>
		</div>
	</div>
</div>
