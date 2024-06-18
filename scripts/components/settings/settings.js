// Based on https://developer.wordpress.org/news/2024/03/26/how-to-use-wordpress-react-components-for-plugin-pages/

import { Toaster } from 'sonner';
import { __ } from '@wordpress/i18n';
import { Button, HStack } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { createContext } from '@wordpress/element';
import { clsx } from '@eightshift/ui-components/utilities';
import { useThemeOptions } from './use-theme-options';

export const EsThemeOptionsContext = createContext(null);

export const tabPanelClassName = 'es-uic-bg-white es-uic-w-full es-uic-max-w-96';

export const ThemeOptionsPage = ({ title = __('Theme options', 'fe-libs-tailwind'), children, settingName }) => {
	const themeOptions = useThemeOptions(settingName);
	const { isLoading, saveSettings } = themeOptions;

	return (
		<EsThemeOptionsContext.Provider value={themeOptions}>
			<Toaster richColors />
			<div className={clsx('es-uic-space-y-4', isLoading && 'es-uic-pointer-events-none es-uic-opacity-60')}>
				<HStack className='es-uic-justify-between'>
					<h1>{title}</h1>

					<Button
						onPress={() => saveSettings()}
						size='large'
						disabled={isLoading}
						icon={isLoading ? icons.moreH : icons.save}
					>
						{isLoading ? __('Saving...', 'fe-libs-tailwind') : __('Save', 'fe-libs-tailwind')}
					</Button>
				</HStack>

				{children}
			</div>
		</EsThemeOptionsContext.Provider>
	);
};
