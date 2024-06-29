import { getTwClasses, props } from '@eightshift/frontend-libs-tailwind/scripts';
import { ListEditor as EditorComponent } from '../../../components/list/components/list-editor';
import manifest from '../manifest.json';

export const ListEditor = ({ attributes, setAttributes }) => {
	return (
		<EditorComponent
			{...props('list', attributes, {
				setAttributes,
				additionalClass: getTwClasses(attributes, manifest),
			})}
		/>
	);
};
