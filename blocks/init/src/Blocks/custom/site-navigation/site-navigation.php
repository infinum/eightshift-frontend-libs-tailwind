<?php

/**
 * Site navigation block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$blockJsClass = $attributes['blockJsClass'] ?? '';

$siteNavigationLinks = Helpers::checkAttr('siteNavigationLinks', $attributes, $manifest) ?? [];
$siteNavigationLogoUrl = Helpers::checkAttr('siteNavigationLogoUrl', $attributes, $manifest);
$siteNavigationLogoId = Helpers::checkAttr('siteNavigationLogoId', $attributes, $manifest);

$logoAlt = get_post_meta($siteNavigationLogoId, '_wp_attachment_image_alt', true) ?? '';

$drawerId = 'navbar-mobile-flyout';
?>

<nav class="<?php echo esc_attr(Helpers::tailwindClasses('wrapper', $attributes, $manifest)); ?>">
	<div class="<?php echo esc_attr(Helpers::tailwindClasses('base', $attributes, $manifest)); ?>">
		<a href="<?php echo esc_url(get_home_url()); ?>">
			<img
				src="<?php echo esc_attr($siteNavigationLogoUrl); ?>"
				alt="<?php echo esc_attr($logoAlt); ?>"
				class="<?php echo esc_attr(Helpers::tailwindClasses('logo', $attributes, $manifest)); ?>"
			>
		</a>

		<div class="<?php echo esc_attr(Helpers::tailwindClasses('linkContainer', $attributes, $manifest)); ?>">
			<?php
			foreach ($siteNavigationLinks as $navLink) {
				$url = $navLink['url'] ?? '';
				$text = $navLink['text'] ?? '';

				if (empty($url) || empty($text)) {
					continue;
				}
				?>
				<a
					href="<?php echo esc_attr($url); ?>"
					class="<?php echo esc_attr(Helpers::tailwindClasses('link', $attributes, $manifest)); ?>"
					<?php if ($navLink['newTab'] ?? false) { ?>
						target="_blank"
						rel="noopener noreferrer"
					<?php } ?>
				>
					<?php echo wp_kses_post($text); ?>
				</a>
			<?php } ?>
		</div>

		<button class="<?php echo esc_attr(Helpers::tailwindClasses('button', $attributes, $manifest, 'sm:hidden')); ?>" data-micromodal-trigger="<?php echo esc_attr($drawerId); ?>">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
			</svg>
		</button>
	</div>
</nav>


<div id="<?php echo esc_attr($drawerId); ?>" aria-hidden="true" class="<?php echo esc_attr(Helpers::tailwindClasses('modalWrapper', $attributes, $manifest)); ?>">
	<div tabindex="-1" class="<?php echo esc_attr(Helpers::tailwindClasses('modalBackdrop', $attributes, $manifest)); ?>" data-micromodal-close>
		<div class="<?php echo esc_attr(Helpers::tailwindClasses('modalContent', $attributes, $manifest)); ?>" role="dialog" aria-modal="true" aria-label="<?php echo esc_html__('Main menu', '%g_textdomain%'); ?>-title">
			<button class="<?php echo esc_attr(Helpers::tailwindClasses('button', $attributes, $manifest, 'ml-auto')); ?>" aria-label="Close menu" data-micromodal-close>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
				</svg>
			</button>

			<div id="<?php echo esc_attr($drawerId); ?>-content">
				<?php
				foreach ($siteNavigationLinks as $navLink) {
					$url = $navLink['url'] ?? '';
					$text = $navLink['text'] ?? '';

					if (empty($url) || empty($text)) {
						continue;
					}
					?>
					<a
						href="<?php echo esc_attr($url); ?>"
						class="<?php echo esc_attr(Helpers::tailwindClasses('drawerLink', $attributes, $manifest)); ?>"
						<?php if ($navLink['newTab'] ?? false) { ?>
							target="_blank"
							rel="noopener noreferrer"
						<?php } ?>
					>
						<?php echo wp_kses_post($text); ?>
					</a>
				<?php } ?>
			</div>
		</div>
	</div>
</div>
