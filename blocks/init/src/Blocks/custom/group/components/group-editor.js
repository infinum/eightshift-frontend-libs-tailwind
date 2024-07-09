import { InnerBlocks } from '@wordpress/block-editor';
import { BlockInserter } from '@eightshift/frontend-libs-tailwind/scripts';

export const GroupEditor = ({ clientId }) => {
	return <InnerBlocks renderAppender={() => <BlockInserter clientId={clientId} />} />;
};
