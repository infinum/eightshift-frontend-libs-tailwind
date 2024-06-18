// Based on https://developer.wordpress.org/news/2024/03/26/how-to-use-wordpress-react-components-for-plugin-pages/

import { Toaster } from 'sonner';
import { __ } from '@wordpress/i18n';
import { Button, Tabs, TabList, Tab, TabPanel, HStack } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { createContext } from '@wordpress/element';
import { clsx } from '@eightshift/ui-components/utilities';
import { useThemeOptions } from '@eightshift/frontend-libs-tailwind/scripts/components/settings/use-theme-options';

export const EsThemeOptionsContext = createContext(null);

export const ThemeOptionsPage = ({ title = __('Theme options', 'fe-libs-tailwind'), tabs }) => {
	const themeOptions = useThemeOptions();
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

				<Tabs>
					<TabList>
						{tabs.map(({ icon, label, subtitle }, index) => {
							return (
								<Tab
									key={index}
									icon={icon}
									label={label}
									subtitle={subtitle}
								/>
							);
						})}
					</TabList>
					{tabs.map(({ panel }, index) => {
						return (
							<TabPanel
								key={index}
								className='es-uic-bg-white es-uic-w-full es-uic-max-w-96'
							>
								{panel}
							</TabPanel>
						);
					})}
				</Tabs>
			</div>
		</EsThemeOptionsContext.Provider>
	);
};
