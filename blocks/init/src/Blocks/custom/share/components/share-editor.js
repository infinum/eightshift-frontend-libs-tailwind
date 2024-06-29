import { props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ShareEditor as EditorComponent } from '../../../components/share/components/share-editor';

export const ShareEditor = ({ attributes, setAttributes }) => {
	return <EditorComponent {...props('share', attributes, { setAttributes })} />;
};
