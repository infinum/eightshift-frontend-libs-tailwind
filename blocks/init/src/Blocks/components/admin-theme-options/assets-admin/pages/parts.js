import { __ } from '@wordpress/i18n';
import { Select, OptionsPanel, OptionsPanelSection, Spacer } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';
import { useContext } from '@wordpress/element';
import { EsThemeOptionsContext } from '@eightshift/frontend-libs-tailwind/scripts';

export const Parts = ({ patterns }) => {
	const { settings, updateSettings, isLoading } = useContext(EsThemeOptionsContext);

	return (
		<OptionsPanel>
			<OptionsPanelSection>
				<Select
					label={__('Header', '%g_textdomain%')}
					icon={icons.header}
					value={settings?.header}
					onChange={(value) => updateSettings({ header: value })}
					options={patterns}
					className='es-uic-w-48'
					disabled={isLoading}
					simpleValue
					clearable
					inline
				/>

				<Select
					label={__('Footer', '%g_textdomain%')}
					icon={icons.footer}
					value={settings?.footer}
					onChange={(value) => updateSettings({ footer: value })}
					options={patterns}
					className='es-uic-w-48'
					disabled={isLoading}
					simpleValue
					clearable
					inline
				/>

				<Spacer size='s' />

				<Select
					label={__('404 page', '%g_textdomain%')}
					icon={icons.emptyCircle}
					value={settings?.fourOhFour}
					onChange={(value) => updateSettings({ fourOhFour: value })}
					options={patterns}
					className='es-uic-w-48'
					disabled={isLoading}
					simpleValue
					clearable
					inline
				/>
			</OptionsPanelSection>
		</OptionsPanel>
	);
};
