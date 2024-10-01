<?php

/**
 * Featured content block template.
 *
 * @package %g_namespace%
 */

use %g_namespace_vendor_prefix%\EightshiftLibs\Helpers\Helpers;

$manifest = Helpers::getManifestByDir(__DIR__);

$blockName = $attributes['blockName'] ?? '';

$featuredContentPostType = Helpers::checkAttr('featuredContentPostType', $attributes, $manifest);
$featuredContentTaxonomy = Helpers::checkAttr('featuredContentTaxonomy', $attributes, $manifest);
$featuredContentTerms = Helpers::checkAttr('featuredContentTerms', $attributes, $manifest);
$featuredContentPosts = Helpers::checkAttr('featuredContentPosts', $attributes, $manifest);
$featuredContentExcludeCurrentPost = Helpers::checkAttr('featuredContentExcludeCurrentPost', $attributes, $manifest);
$featuredContentUseCurrentTerm = Helpers::checkAttr('featuredContentUseCurrentTerm', $attributes, $manifest);
$featuredContentRandomOrder = Helpers::checkAttr('featuredContentRandomOrder', $attributes, $manifest);
$featuredContentLoadMoreUse = Helpers::checkAttr('featuredContentLoadMoreUse', $attributes, $manifest);
$featuredContentPerPage = Helpers::checkAttr('featuredContentPerPage', $attributes, $manifest);

$featuredContentServerSideRender = Helpers::checkAttr('featuredContentServerSideRender', $attributes, $manifest);

if (!empty($featuredContentPostType)) {
	$featuredContentPostType = $featuredContentPostType['value'];
}

if (!empty($featuredContentTaxonomy)) {
	$featuredContentTaxonomy = $featuredContentTaxonomy['value'];
}

global $post;

$args = [
	'post_type' => $featuredContentPostType,
	'posts_per_page' => $featuredContentPerPage,
	'fields' => 'ids',
	'order' => 'ASC',
];

// phpcs:ignore WordPress.Security.NonceVerification.Recommended
if (isset($_GET['current-page'])) {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$skipToPage = sanitize_text_field(wp_unslash($_GET['current-page']));

	$args['posts_per_page'] = $featuredContentPerPage * $skipToPage;
}

if ($featuredContentTaxonomy) {
	$args['tax_query'][0] = [
		'taxonomy' => $featuredContentTaxonomy,
		'field' => 'id',
	];

	if ($featuredContentTerms) {
		$args['tax_query'][0]['terms'] = array_map(fn ($item) => $item['value'], (array) $featuredContentTerms);
	} elseif ($featuredContentUseCurrentTerm && $post instanceof WP_Post) {
		$currentTerms = get_the_terms($post->ID, strval($featuredContentTaxonomy));

		if ($currentTerms) {
			$args['tax_query'][0]['terms'] = wp_list_pluck($currentTerms, 'term_id');
		}
	} else {
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		$args['tax_query'][0]['operator'] = 'NOT IN';
	}
}

$excludeList = [];

if ($featuredContentExcludeCurrentPost && $post instanceof WP_Post) {
	$excludeList[] = $post->ID;
}

if ($excludeList) {
	$args['post__not_in'] = $excludeList;
}

if ($featuredContentPosts) {
	$args['post__in'] = array_map(fn($item) => $item['value'], (array)$featuredContentPosts);
	$args['orderby'] = 'post__in';
}

if ($featuredContentRandomOrder) {
	$args['orderby'] = 'rand';
}

$mainQuery = new WP_Query($args);

if (!$mainQuery->have_posts()) {
	return;
}

wp_reset_postdata();

$unique = Helpers::getUnique();
$loadMoreId = "{$blockName}-{$unique}";

$args['posts_per_page'] = $featuredContentPerPage;
?>

<div>
	<div
		id="<?php echo esc_attr($loadMoreId); ?>"
		class="<?php echo esc_attr(Helpers::tailwindClasses('base', $attributes, $manifest)); ?>"
		aria-live="polite"
	>
		<?php
		echo Helpers::render(
			'cards',
			[
				'items' => $mainQuery->posts,
			],
			'blocks',
			false,
			"{$blockName}/partials"
		);
		?>
	</div>

	<?php
	// phpcs:ignore Squiz.NamingConventions.ValidVariableName.MemberNotCamelCaps
	if (!$featuredContentServerSideRender && $mainQuery->max_num_pages > 1) { ?>
		<div class="<?php echo esc_attr(Helpers::tailwindClasses('loadMoreContainer', $attributes, $manifest)); ?>">
			<?php
			echo Helpers::render('load-more', Helpers::props('loadMore', $attributes, [
				'loadMoreInitialItems' => wp_json_encode($mainQuery->posts),
				'loadMoreQuery' => wp_json_encode($args),
				'loadMoreId' => $loadMoreId,
				'loadMoreType' => $blockName,
				'loadMorePage' => $skipToPage ?? 1,
			]));
			?>
		</div>
	<?php } ?>
</div>
