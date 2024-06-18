import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import { toast } from 'sonner';
import apiFetch from '@wordpress/api-fetch';

export const useThemeOptions = (settingName = 'eightshift-theme-options') => {
	const [settings, setSettings] = useState();
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		apiFetch({ path: '/wp/v2/settings' }).then((settings) => {
			setSettings(settings?.[settingName]);
		});
	}, []);

	const saveSettings = async () => {
		setIsLoading(true);

		try {
			await apiFetch({
				path: '/wp/v2/settings',
				method: 'POST',
				data: {
					[settingName]: settings,
				},
			});

			toast.success(__('Saved successfully', 'fe-libs-tailwind'));
		} catch (error) {
			toast.error(__('Something went wrong while saving', 'fe-libs-tailwind'), {
				description: error.message,
			});
		} finally {
			setIsLoading(false);
		}
	};

	const updateSettings = (modified) => {
		setSettings((prev) => ({
			...prev,
			...modified,
		}));
	};

	return {
		isLoading,
		settings,
		saveSettings,
		setSettings,
		updateSettings,
	};
};
