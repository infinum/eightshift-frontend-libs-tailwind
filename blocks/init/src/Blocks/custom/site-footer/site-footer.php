<?php

/**
 * Site footer block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$siteFooterPrimary = Helpers::checkAttr('siteFooterPrimary', $attributes, $manifest);
$siteFooterCopyright = Helpers::checkAttr('siteFooterCopyright', $attributes, $manifest);

$siteFooterLogoUrl = Helpers::checkAttr('siteFooterLogoUrl', $attributes, $manifest);
$siteFooterLogoId = Helpers::checkAttr('siteFooterLogoId', $attributes, $manifest);

$logoAlt = get_post_meta($siteFooterLogoId, '_wp_attachment_image_alt', true) ?? '';
?>

<div class="<?php echo esc_attr(Helpers::tailwindClasses('base', $attributes, $manifest)); ?>">
	<div class="<?php echo esc_attr(Helpers::tailwindClasses('topContainer', $attributes, $manifest)); ?>">
		<a href="<?php echo esc_url(get_home_url()); ?>">
			<img
				src="<?php echo esc_attr($siteFooterLogoUrl); ?>"
				alt="<?php echo esc_attr($logoAlt); ?>"
				class="<?php echo esc_attr(Helpers::tailwindClasses('logo', $attributes, $manifest)); ?>"
			>
		</a>
		<div class="<?php echo esc_attr(Helpers::tailwindClasses('linksContainer', $attributes, $manifest)); ?>">

			<?php
			foreach ($siteFooterPrimary as $index => $value) {
				$items = $value['items'] ?? [];
				$header = $value['header'] ?? '';
				?>
				<div class="<?php echo esc_attr(Helpers::tailwindClasses('sectionContainer', $attributes, $manifest)); ?>">
					<p class="<?php echo esc_attr(Helpers::tailwindClasses('sectionTitle', $attributes, $manifest)); ?>">
						<?php echo wp_kses_post($header); ?>
					</p>

					<?php
					foreach ($items as $item) {
						$url = $item['url'] ?? '';
						?>
						<a
							href="<?php echo esc_url($item['url']); ?>"
							class="<?php echo esc_attr(Helpers::tailwindClasses('link', $attributes, $manifest)); ?>"
							<?php if ($item['newTab'] ?? false) { ?>
								target="_blank"
								rel="noopener noreferrer"
							<?php } ?>
						>
							<?php echo wp_kses_post($item['text'] ?? ''); ?>
						</a>
					<?php } ?>
				</div>
			<?php } ?>
		</div>
	</div>

	<div class="<?php echo esc_attr(Helpers::tailwindClasses('bottomContainer', $attributes, $manifest)); ?>">
		<?php if (!empty($siteFooterCopyright)) { ?>
			<span class="<?php echo esc_attr(Helpers::tailwindClasses('copyright', $attributes, $manifest)); ?>">
				&copy; <?php echo esc_attr($siteFooterCopyright); ?>
			</span>
		<?php } ?>

		<?php
		echo Helpers::render('share', Helpers::props('share', $attributes));
		?>
	</div>
</div>
