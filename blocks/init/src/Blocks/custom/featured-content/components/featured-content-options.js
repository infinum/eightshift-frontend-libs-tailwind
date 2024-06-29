import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { getAttrKey, checkAttr, getOption, props, fetchFromWpRest } from '@eightshift/frontend-libs-tailwind/scripts';
import { LoadMoreOptions } from '../../../components/load-more/components/load-more-options';
import {
	AnimatedVisibility,
	AsyncMultiSelect,
	BaseControl,
	HStack,
	NumberPicker,
	OptionSelect,
	Select,
	Spacer,
	Toggle,
} from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import manifest from '../manifest.json';

export const FeaturedContentOptions = ({ attributes, setAttributes }) => {
	const featuredContentPostType = checkAttr('featuredContentPostType', attributes, manifest);
	const featuredContentTaxonomy = checkAttr('featuredContentTaxonomy', attributes, manifest, true);
	const featuredContentTerms = checkAttr('featuredContentTerms', attributes, manifest) ?? [];
	const featuredContentUseCurrentTerm = checkAttr('featuredContentUseCurrentTerm', attributes, manifest);
	const featuredContentPosts = checkAttr('featuredContentPosts', attributes, manifest) ?? [];
	const featuredContentExcludeCurrentPost = checkAttr('featuredContentExcludeCurrentPost', attributes, manifest);
	const featuredContentRandomOrder = checkAttr('featuredContentRandomOrder', attributes, manifest);
	const featuredContentLayout = checkAttr('featuredContentLayout', attributes, manifest);
	const featuredContentPerPage = checkAttr('featuredContentPerPage', attributes, manifest);

	const allGenericOption = { label: __('Show all', '%g_textdomain%'), value: '_all', separator: 'below' };

	const postTypeOptions = getOption('featuredContentPostType', attributes, manifest);
	const taxonomyOptions = [allGenericOption, ...getOption('featuredContentTaxonomy', attributes, manifest)];

	// Set internal store for specific items.
	const [useSpecificPosts, setUseSpecificPosts] = useState(featuredContentPosts?.length > 0);
	const [useSpecificTerms, setUseSpecificTerms] = useState(featuredContentTerms?.length > 0);

	return (
		<>
			<OptionSelect
				icon={icons.layoutAlt3}
				label={__('Layout', '%g_textdomain%')}
				value={featuredContentLayout}
				onChange={(value) => setAttributes({ [getAttrKey('featuredContentLayout', attributes, manifest)]: value })}
				options={getOption('featuredContentLayout', attributes, manifest)}
				type='menu'
				inline
			/>

			<NumberPicker
				icon={icons.dummySpacer}
				label={__('Items per page', '%g_textdomain%')}
				value={featuredContentPerPage}
				onChange={(value) => setAttributes({ [getAttrKey('featuredContentPerPage', attributes, manifest)]: value })}
				min={1}
				inline
			/>

			<Spacer />
			<Spacer />

			<OptionSelect
				icon={icons.multiple}
				label={__('Content type', '%g_textdomain%')}
				value={featuredContentPostType?.value}
				options={postTypeOptions}
				onChange={(rawValue) => {
					setUseSpecificPosts(false);
					setUseSpecificTerms(false);

					const value = postTypeOptions.find((option) => option.value === rawValue);

					setAttributes({
						[getAttrKey('featuredContentPostType', attributes, manifest)]: value,
						[getAttrKey('featuredContentTaxonomy', attributes, manifest)]: undefined,
						[getAttrKey('featuredContentTerms', attributes, manifest)]: undefined,
						[getAttrKey('featuredContentUseCurrentTerm', attributes, manifest)]: false,
						[getAttrKey('featuredContentPosts', attributes, manifest)]: undefined,
					});
				}}
				type='menu'
				inline
			/>

			<OptionSelect
				aria-label={__('Select items to show', '%g_textdomain%')}
				value={useSpecificPosts}
				onChange={() => {
					setUseSpecificPosts(!useSpecificPosts);
					setAttributes({
						[getAttrKey('featuredContentPosts', attributes, manifest)]: undefined,
					});
				}}
				options={[
					{ label: __('Show all posts', '%g_textdomain%'), value: false },
					{
						label: __('Select posts to show', '%g_textdomain%'),
						value: true,
						disabled: featuredContentExcludeCurrentPost || featuredContentTaxonomy,
						subtitle:(featuredContentExcludeCurrentPost || featuredContentTaxonomy) && __('Unavailable when a taxonomy filter is set', '%g_textdomain%')
					},
				]}
				type='radiosSegmented'
				vertical
			/>

			<AnimatedVisibility
				noInitial
				visible={!useSpecificPosts}
			>
				<Toggle
					icon={icons.excludeItemAlt}
					label={__('Exclude current', '%g_textdomain%')}
					subtitle={__('Best used with blog posts', '%g_textdomain%')}
					checked={featuredContentExcludeCurrentPost}
					onChange={(value) =>
						setAttributes({ [getAttrKey('featuredContentExcludeCurrentPost', attributes, manifest)]: value })
					}
				/>
			</AnimatedVisibility>

			<AnimatedVisibility
				noInitial
				visible={useSpecificPosts && !featuredContentExcludeCurrentPost}
			>
				<AsyncMultiSelect
					key={featuredContentPostType.value}
					help={__(
						'Newest 30 items are shown, others can be selected by searching. If blank, all items are shown.',
						'%g_textdomain%',
					)}
					value={featuredContentPosts}
					loadOptions={fetchFromWpRest(featuredContentPostType?.api, {
						processLabel: ({ title: { rendered } }) => rendered,
						noCache: true,
					})}
					onChange={(value) => setAttributes({ [getAttrKey('featuredContentPosts', attributes, manifest)]: value })}
					reFetchOnSearch
				/>
			</AnimatedVisibility>

			<Spacer />

			<Toggle
				icon={icons.dice}
				label={__('Randomize order', '%g_textdomain%')}
				checked={featuredContentRandomOrder}
				onChange={(value) => setAttributes({ [getAttrKey('featuredContentRandomOrder', attributes, manifest)]: value })}
			/>

			<Spacer />
			<Spacer />

			<OptionSelect
				icon={icons.filter}
				label={__('Taxonomy', '%g_textdomain%')}
				value={(featuredContentTaxonomy ?? allGenericOption)?.value}
				options={taxonomyOptions}
				onChange={(rawValue) => {
					setUseSpecificPosts(false);
					setUseSpecificTerms(false);

					const value =
						rawValue === '_all' ? allGenericOption : taxonomyOptions.find((option) => option.value === rawValue);

					setAttributes({
						[getAttrKey('featuredContentTaxonomy', attributes, manifest)]:
							value === allGenericOption ? undefined : value,
						[getAttrKey('featuredContentTerms', attributes, manifest)]: undefined,
						[getAttrKey('featuredContentUseCurrentTerm', attributes, manifest)]: false,
						[getAttrKey('featuredContentPosts', attributes, manifest)]: undefined,
					});
				}}
				hidden={featuredContentPostType?.taxonomies?.length < 1}
				type='menu'
				inline
			/>

			<OptionSelect
				aria-label={__('Select terms to show', '%g_textdomain%')}
				value={featuredContentUseCurrentTerm ? 'current' : useSpecificTerms ? 'manual' : 'all'}
				onChange={(value) => {
					setUseSpecificTerms(value === 'manual');
					setAttributes({
						[getAttrKey('featuredContentTerms', attributes, manifest)]: undefined,
						[getAttrKey('featuredContentUseCurrentTerm', attributes, manifest)]: value === 'current',
					});
				}}
				options={[
					{ label: __('Show all terms', '%g_textdomain%'), value: 'all' },
					{
						label: __('Select terms to show', '%g_textdomain%'),
						value: 'manual',
					},
					{
						label: __('Show same terms as current post', '%g_textdomain%'),
						value: 'current',
					},
				]}
				type='radiosSegmented'
				vertical
			/>

			<AnimatedVisibility
				noInitial
				visible={useSpecificTerms && !featuredContentUseCurrentTerm}
			>
				<AsyncMultiSelect
					key={featuredContentTaxonomy?.value}
					help={__(
						'Newest 30 items are shown, others can be selected by searching. If blank, all items are shown.',
						'%g_textdomain%',
					)}
					value={featuredContentTerms}
					loadOptions={fetchFromWpRest(featuredContentTaxonomy?.api, {
						fields: 'id,name',
						processId: ({ id }) => id,
						processLabel: ({ name }) => name,
						noCache: true,
					})}
					onChange={(value) => setAttributes({ [getAttrKey('featuredContentTerms', attributes, manifest)]: value })}
					reFetchOnSearch
					placeholder={__('Select terms to show', '%g_textdomain%')}
				/>
			</AnimatedVisibility>

			<Spacer />

			<LoadMoreOptions
				{...props('loadMore', attributes, {
					setAttributes,
				})}
				label={__('"Load more" button', '%g_textdomain%')}
				noUseToggle
			/>
		</>
	);
};
