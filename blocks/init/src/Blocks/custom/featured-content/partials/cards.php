<?php

/**
 * Template for the Featured Content view - Card content map from ID.
 *
 * @package %g_namespace%
 */

$items = $attributes['items'] ?? [];
$hasEnterAnimation = $attributes['hasEnterAnimation'] ?? false;

$output = [];

if (!$items) {
	return $output;
}

foreach ($items as $item) {
	$featuredImage = get_the_post_thumbnail_url($item, 'full');
	?>
	<a
		href="<?php echo esc_attr(get_the_permalink($item)); ?>"
		class="group rounded-xl relative overflow-hidden w-full aspect-[0.875] bg-gradient-to-b from-gray-100 to-white shadow-md hover:shadow-lg transition duration-500 hover:duration-1000 border border-gray-200 <?php echo $hasEnterAnimation ? 'animate-in zoom-in-110 fade-in' : ''; ?>"
	>
		<?php if (!empty($featuredImage)) { ?>
			<img class="absolute inset-0 !size-full object-cover group-hover:scale-105 origin-bottom transition-transform duration-500 group-hover:duration-1000 pointer-events-none select-none" src="<?php echo esc_url($featuredImage); ?>" alt="">
			<div class=" absolute inset-0 backdrop-blur [mask-image:_linear-gradient(to_bottom,_transparent_5%,_black_50%)]"></div>
			<div class=" absolute inset-0 backdrop-blur-lg [mask-image:_linear-gradient(to_bottom,_transparent_20%,_black_100%)]"></div>
			<div class=" absolute inset-0 backdrop-blur-3xl [mask-image:_linear-gradient(to_bottom,_transparent_85%,_black_100%)]"></div>
			<div class="absolute inset-0 backdrop-saturate-[125%] backdrop-brightness-150"></div>
			<div class="absolute inset-0 bg-black/50 [&+div]:text-white [mask-image:_linear-gradient(to_bottom,_transparent_25%,_black_80%)]"></div>
		<?php } ?>
		<div class="flex flex-col justify-end p-6 absolute inset-0 group-hover:scale-[1.025] origin-bottom-left transition-transform duration-500 group-hover:duration-1000">
			<p class="text-xs opacity-45 uppercase mb-0.5"><?php echo get_the_date('', $item); ?></p>
			<p class="~sm/md:~text-lg/3xl !leading-tight font-display line-clamp-3 text-balance"><?php echo esc_html(get_the_title($item)); ?></p>
		</div>
	</a>
	<?php
}
