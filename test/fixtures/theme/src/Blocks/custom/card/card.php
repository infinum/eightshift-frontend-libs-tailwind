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
$foreign = FormsHelper::getTwPart($data, 'field', 'label-icon', 'item-inner');
$nested = Helpers::clsx([Helpers::selector($isRequired, $component, '', 'is-required'), 'w-[16px]']);
$compared = Helpers::clsx([$layout === 'layout-grid-half' ? 'w-[16px]' : 'h-full', 'layout-other' !== $layout ? 'flex' : '']);
$other = Helpers::clsx(['h-full w-full', 'text-xs' => $isSmall]);
?>
<div class="card__wrap aspect-[5/3]">
	<span class="<?php echo esc_attr($classes); ?>"></span>
	<span class="text-%s"></span>
</div>
