<?php
$classes = Helpers::tailwindClasses('base-part', $attributes, $manifest, 'text-lg w-[16px]', "js-{$name}");
$third = Helpers::tailwindClasses(
	// The card's part, then its classes.
	'title-part',
	$attributes,
	$manifest,
	'w-[16px]',
);
$notAClass = 'text-unknown-after';
$other = Helpers::clsx(['h-full w-full', 'text-xs' => $isSmall]);
?>
<div class="card__wrap aspect-[5/3]">
	<span class="<?php echo esc_attr($classes); ?>"></span>
	<span class="text-%s"></span>
</div>
