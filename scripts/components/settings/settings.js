// Based on https://developer.wordpress.org/news/2024/03/26/how-to-use-wordpress-react-components-for-plugin-pages/

import { Toaster } from 'sonner';
import { __ } from '@wordpress/i18n';
import { Button, OptionsPanelHeader } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { createContext } from '@wordpress/element';
import { useThemeOptions } from './use-theme-options';

export const EsThemeOptionsContext = createContext(null);

export const ThemeOptionsPage = ({
	title = __('Theme options', 'eightshift-frontend-libs-tailwind'),
	children,
	settingName = 'eightshift-theme-options',
}) => {
	const themeOptions = useThemeOptions(settingName);
	const { isLoading, saveSettings } = themeOptions;

	return (
		<>
			<EsThemeOptionsContext.Provider value={themeOptions}>
				<OptionsPanelHeader
					title={title}
					actions={
						<Button
							onPress={() => saveSettings()}
							disabled={isLoading}
							icon={isLoading ? icons.moreH : icons.save}
						>
							{isLoading
								? __('Saving...', 'eightshift-frontend-libs-tailwind')
								: __('Save', 'eightshift-frontend-libs-tailwind')}
						</Button>
					}
				/>

				{children}
			</EsThemeOptionsContext.Provider>

			<Toaster richColors />
		</>
	);
};
