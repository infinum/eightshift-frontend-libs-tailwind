<?php

/**
 * Video component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);
$componentName = $attributes['componentName'] ?? $manifest['componentName'];

$videoUse = Helpers::checkAttr('videoUse', $attributes, $manifest);

if (!$videoUse) {
	return;
}

$additionalClass = $attributes['additionalClass'] ?? '';

$videoUrl = Helpers::checkAttr('videoUrl', $attributes, $manifest, true);

if (empty($videoUrl)) {
	return;
}

$videoMimeType = Helpers::checkAttr('videoMimeType', $attributes, $manifest);
$videoPosterUrl = Helpers::checkAttr('videoPosterUrl', $attributes, $manifest);
$videoLoop = Helpers::checkAttr('videoLoop', $attributes, $manifest);
$videoAutoplay = Helpers::checkAttr('videoAutoplay', $attributes, $manifest);
$videoControls = Helpers::checkAttr('videoControls', $attributes, $manifest);
$videoMuted = Helpers::checkAttr('videoMuted', $attributes, $manifest);
$videoPreload = Helpers::checkAttr('videoPreload', $attributes, $manifest);
$videoSubtitleTracks = Helpers::checkAttr('videoSubtitleTracks', $attributes, $manifest) ?? [];

$additionalAttributes = Helpers::classnames([
	$videoLoop ? 'loop' : '',
	$videoAutoplay ? 'autoplay playsinline' : '',
	$videoControls ? 'controls' : '',
	$videoMuted ? 'muted' : '',
]);
?>

<video
	class="<?php echo esc_attr(Helpers::tailwindClasses('video', $attributes, $manifest)); ?>"
	<?php echo esc_attr($additionalAttributes); ?>
	preload="<?php echo esc_attr($videoPreload); ?>"
	<?php if ($videoPosterUrl) { ?>
		poster="<?php echo esc_attr($videoPosterUrl); ?>"
	<?php } ?>
>
	<source src="<?php echo esc_url($videoUrl); ?>" type="<?php echo esc_attr($videoMimeType); ?>" />

	<?php foreach ($videoSubtitleTracks as $track) {
		if (!($track['trackFileName'] ?? '') || !($track['kind'] ?? '') || !($track['label'])) {
			continue;
		}
		?>

		<track
			src="<?php echo esc_url($track['trackFileName']); ?>"
			kind="<?php echo esc_attr($track['kind']); ?>"
			label="<?php echo esc_attr($track['label']); ?>"
			<?php if ($track['srclang']) { ?>
				srclang="<?php echo esc_attr($track['srclang']); ?>"
			<?php } ?>
		>
	<?php } ?>
</video>
