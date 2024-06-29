import domReady from '@wordpress/dom-ready';
import { __ } from '@wordpress/i18n';
import { createRoot } from '@wordpress/element';
import { ThemeOptionsPage } from '@eightshift/frontend-libs-tailwind/scripts';
import { Parts } from './pages/parts';
import { Tabs, TabList, Tab, TabPanel } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';

domReady(() => {
	const rootElement = document.getElementById('es-theme-options');

	if (!rootElement) {
		return;
	}

	const root = createRoot(rootElement);
	const patterns = JSON.parse(document.getElementById('es-pattern-data')?.value ?? '[]');

	root.render(
		<ThemeOptionsPage>
			<Tabs>
				<TabList>
					<Tab
						icon={icons.wrench}
						label={__('Parts', '%g_textdomain%')}
					/>
				</TabList>
				<TabPanel>
					<Parts patterns={patterns} />
				</TabPanel>
			</Tabs>
		</ThemeOptionsPage>,
	);
});

// https://developer.wordpress.org/news/2024/03/26/how-to-use-wordpress-react-components-for-plugin-pages/
