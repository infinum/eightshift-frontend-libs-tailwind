<?php

/**
 * Share component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$shareUse = Helpers::checkAttr('shareUse', $attributes, $manifest);

if (!$shareUse) {
	return;
}

$shareTargets = Helpers::checkAttr('shareTargets', $attributes, $manifest);
$shareMode = Helpers::checkAttr('shareMode', $attributes, $manifest);

$additionalClass = $attributes['additionalClass'] ?? '';

?>
<div class="<?php echo esc_attr(Helpers::getTwPart('container', $manifest, $additionalClass)); ?>">
	<?php
	if ($shareMode) {
		foreach ($shareTargets as $networkName) {
			$shareUrl = $manifest['networks'][$networkName]['shareUrl'] ?? '';
			$shareUrl = str_replace('POST_TITLE', get_the_title(), $shareUrl);
			$shareUrl = str_replace('POST_URL', get_the_permalink(), $shareUrl);
			$shareUrl = str_replace('POST_FEATURED_IMAGE', get_the_post_thumbnail_url(get_the_ID(), 'large'), $shareUrl);
			?>
			<button
				class="<?php echo esc_attr(Helpers::getTwPart('icon', $manifest)); ?>"
				data-network="<?php echo esc_attr($networkName); ?>"
				data-share-url="<?php echo esc_url($shareUrl); ?>"
				data-page-title="<?php echo esc_attr(get_the_title()); ?>"
				data-page-url="<?php echo esc_url(get_the_permalink()); ?>"
			>
				<?php
				// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
				echo $manifest['networks'][$networkName]['icon'] ?? '';
				?>
			</button>
		<?php }
	} else {
		foreach ($shareTargets as $networkName) {
			?>
			<a
				class="<?php echo esc_attr(Helpers::getTwPart('icon', $manifest)); ?>"
				href="<?php echo esc_url($manifest['networks'][$networkName]['url'] ?? ''); ?>"
				title="<?php echo esc_attr($manifest['networks'][$networkName]['title'] ?? ''); ?>"
				target="_blank"
				rel="noreferrer noopener"
			>
				<?php
				// phpcs:ignore Eightshift.Security.HelpersEscape.OutputNotEscaped
				echo $manifest['networks'][$networkName]['icon'] ?? '';
				?>
			</a>
			<?php
		}
	}
	?>
</div>
