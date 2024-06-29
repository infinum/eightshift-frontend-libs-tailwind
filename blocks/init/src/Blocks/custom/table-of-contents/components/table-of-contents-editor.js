import { __, sprintf } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { checkAttr, getTwPart } from '@eightshift/frontend-libs-tailwind/scripts';
import { clsx } from '@eightshift/ui-components/utilities';
import manifest from '../manifest.json';

export const TableOfContentsEditor = ({ attributes, setAttributes }) => {
	const tableOfContentsDescription = checkAttr('tableOfContentsDescription', attributes, manifest);
	const tableOfContentsHeadingLevels = checkAttr('tableOfContentsHeadingLevels', attributes, manifest);

	return (
		<div className={getTwPart('container', manifest)}>
			<RichText
				placeholder={manifest.attributes.tableOfContentsDescription.default}
				value={tableOfContentsDescription}
				onChange={(value) => setAttributes({ [getAttrKey('tableOfContentsDescription', attributes, manifest)]: value })}
				allowedFormats={[]}
				className={getTwPart('description', manifest)}
			/>

			{Object.entries(tableOfContentsHeadingLevels).map(([tag, enabled = false]) => (
				<DemoTocItem
					level={parseInt(tag.replace('h', ''))}
					disabled={!enabled}
				/>
			))}
		</div>
	);
};

const DemoTocItem = ({ level, disabled }) => (
	<div class={clsx('group block select-none py-0.5 focus:outline-none', disabled && 'pointer-events-none opacity-25')}>
		{level > 1 && <span class='mr-1.5 tracking-tighter text-gray-300'>{'–'.repeat(level - 1)}</span>}
		<span class='group-focus-visible:text-navy-50px-0.5 rounded text-sm transition group-hover:bg-navy-100 group-hover:text-navy-950 group-hover:ring-4 group-hover:ring-navy-100 group-focus-visible:bg-navy-950 group-focus-visible:ring-4 group-focus-visible:ring-navy-950'>
			{sprintf(__('Heading %d', '%g_textdomain%'), level)}
		</span>
	</div>
);
