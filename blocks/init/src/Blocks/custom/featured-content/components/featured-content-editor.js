import { ServerSideRender, tailwindClasses, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { LoadMoreEditor } from '../../../components/load-more/components/load-more-editor';
import manifest from '../manifest.json';

export const FeaturedContentEditor = ({ attributes, setAttributes }) => {
	const { blockFullName } = attributes;

	return (
		<>
			<ServerSideRender
				block={blockFullName}
				attributes={{
					...attributes,
					featuredContentServerSideRender: true,
					wrapperUse: false,
				}}
			/>

			<div className={tailwindClasses('loadMoreContainer', attributes, manifest)}>
				<LoadMoreEditor
					{...props('loadMore', attributes, {
						setAttributes,
					})}
				/>
			</div>
		</>
	);
};
