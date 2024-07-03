<?php

/**
 * Post header component template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$featuredImage = get_the_post_thumbnail_url(get_the_ID(), 'full') ?? '';
?>

<div class="isolate bg-gray-200 !col-span-full min-h-80 grid grid-cols-[auto_1fr_auto] md:grid-cols-subgrid grid-rows-1 mb-10">
	<?php if (!empty($featuredImage)) { ?>
		<img class="w-full h-80 col-span-full -z-10 object-cover row-start-1" src="<?php echo esc_attr($featuredImage); ?>" alt="" role="presentation">
	<?php } ?>
	<div class="~sm/md:~mx-4/12 ~sm/md:~px-4/8 ~sm/md:~py-4/6 col-start-2 row-start-1 bg-black/75 text-white border border-b-0 border-black/25 backdrop-blur-2xl backdrop-brightness-110 backdrop-saturate-150 self-end">
		<h1 class="font-display text-balance font-synthesis-none ~text-5xl/6xl !leading-none font-soft-25 italic"><?php echo esc_html(get_the_title()); ?></h1>
		<span class="opacity-75 text-sm"><?php echo esc_html(get_the_date()); ?></span>
	</div>
</div>
