/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback } from 'react';
import { __ } from '@wordpress/i18n';
import { RichText } from '@wordpress/block-editor';
import { Button } from '@eightshift/ui-components';
import { icons } from '@eightshift/ui-components/icons';

/**
 * Link section editor.
 *
 * @component
 * @param {object} props - Component props.
 * @param {{ header: string, items: [{ text: string, url: string, newTab: boolean }] }[]} props.links - Link data.
 * @param {Function} props.onChange - Function to call when links are changed.
 * @param {object} props.classNames - Classes to pass to inner components.
 *
 * @returns {object} LinkSectionEditor component.
 *
 * @example
 * const links = [
 * 	{
 * 		header: 'Section 1',
 * 		items: [
 * 			{
 * 				text: 'Link 1',
 * 				url: 'https://example.com',
 * 				newTab: false,
 * 			},
 * 			{
 * 				text: 'Link 2',
 * 				url: 'https://example.com',
 * 				newTab: false,
 * 			},
 * 		],
 * 	},
 * 	{
 * 		header: 'Section 2',
 * 		items: [
 * 			{
 * 				text: 'Link 1',
 * 				url: 'https://example.com',
 * 				newTab: false,
 * 			},
 * 			{
 * 				text: 'Link 2',
 * 				url: 'https://example.com',
 * 				newTab: false,
 * 			},
 * 		],
 * 	},
 * ];
 *
 * <LinkSectionEditor
 * 	links={links}
 * 	onChange={(newLinks) => setAttributes({ links: newLinks })}
 * 	classNames={{
 * 		sectionContainer: 'section-container',
 * 		sectionTitle: 'section-title',
 * 		link: 'link',
 * 	}}
 * />;
 */
export const LinkSectionEditor = (props) => {
	const { links, onChange, classNames } = props;

	const defaultLink = {
		text: '',
		url: '',
		newTab: false,
	};

	const defaultSection = {
		header: '',
		items: [defaultLink],
	};

	const addSection = useCallback(
		(index = -1) => {
			if (index < 0) {
				onChange([...links, defaultSection]);
				return;
			}

			const before = links.slice(0, index + 1);
			const after = links.slice(index + 1);

			onChange([...before, defaultSection, ...after]);
		},
		[links, onChange],
	);

	const addLink = useCallback(
		(items, itemIndex, index = -1) => {
			if (index < 0) {
				updateItem(itemIndex, {
					items: [defaultLink, ...items],
				});
				return;
			}
			const before = items.slice(0, index + 1);
			const after = items.slice(index + 1);

			updateItem(itemIndex, {
				items: [...before, defaultLink, ...after],
			});
		},
		[links, onChange],
	);

	const updateItem = useCallback(
		(index, value) => {
			const newValue = [...links];

			newValue[index] = {
				...newValue[index],
				...value,
			};

			onChange(newValue);
		},
		[links, onChange],
	);

	const updateInnerItem = useCallback(
		(index, innerIndex, value) => {
			const newValue = [...links];

			newValue[index].items[innerIndex] = {
				...newValue[index].items[innerIndex],
				...value,
			};

			onChange(newValue);
		},
		[links, onChange],
	);

	const jumpToEnd = useCallback(
		(element) => {
			if (!element) {
				return;
			}

			const textNode = element.childNodes[0];

			if (!textNode) {
				return;
			}

			const selection = document.getSelection();
			selection.removeAllRanges();

			const range = document.createRange();
			range.setStart(textNode, textNode?.length);
			range.setEnd(textNode, textNode?.length);

			selection.addRange(range);
		},
		[links, onChange],
	);

	const handleKeyDown = useCallback(
		(event, index, i, text) => {
			const { code, target } = event;

			const { baseNode, baseOffset } = document.getSelection();

			if (!baseNode || !target.contains(baseNode)) {
				return;
			}

			if (baseOffset === text.length && code === 'Enter' && !(event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				addLink(links[index].items, index, i);

				setTimeout(() => {
					target.nextElementSibling?.focus();
				}, 25);
			} else if (baseOffset === text.length && code === 'Enter' && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				addSection(index);

				setTimeout(() => {
					target.parentElement.nextElementSibling?.querySelector('[contenteditable="true"]')?.focus();
				}, 25);
			} else if (code === 'Backspace' && text === '') {
				event.preventDefault();

				jumpToEnd(target.previousElementSibling);

				updateItem(index, {
					items: links[index].items.filter((_, j) => j !== i),
				});
			} else if (code === 'Delete' && links?.[index].items[i + 1]?.text?.length < 1) {
				event.preventDefault();

				updateItem(index, {
					items: links[index].items.filter((_, j) => j !== i + 1),
				});
			}
		},
		[links, onChange],
	);

	// keyDown handling for section headers.
	const handleSectionKeyDown = useCallback(
		(event, index, items, header) => {
			const { code, target } = event;

			const { baseNode, baseOffset } = document.getSelection();

			if (!target.contains(baseNode)) {
				return;
			}

			if (baseOffset === header.length && code === 'Enter' && !(event.metaKey || event.ctrlKey)) {
				event.preventDefault();

				// Add a link to the first spot.
				if (items.length > 1 || items?.[0]?.text !== '') {
					addLink(links[index].items, index);
				}

				// Focus on that link.
				setTimeout(() => {
					target.nextElementSibling?.focus();
				}, 25);
			} else if (baseOffset === header.length && code === 'Enter' && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();

				// Add a section.
				addSection(index);

				// Focus on next text input.
				setTimeout(() => {
					target.parentElement.nextElementSibling?.querySelector('[contenteditable="true"]')?.focus();
				}, 25);
			} else if (code === 'Backspace' && header === '' && (items?.length < 1 || items?.every(({ text }) => text === ''))) {
				event.preventDefault();

				// Jump to end of previous input.
				jumpToEnd(target.parentElement.previousElementSibling?.querySelector('[contenteditable="true"]:last-of-type'));

				// Remove current element.
				setTimeout(() => {
					onChange(links.filter((_, i) => i !== index));
				}, 25);
			}
		},
		[links, onChange],
	);

	return (
		<>
			{links.map(({ items, header }, index) => {
				return (
					<div className={classNames?.sectionContainer} key={index}>
						<RichText
							placeholder={__('Section', 'eightshift-frontend-libs')}
							value={header}
							onChange={(value) => updateItem(index, { header: value })}
							allowedFormats={[]}
							className={classNames?.sectionTitle}
							onKeyDown={(event) => handleSectionKeyDown(event, index, items, header)}
							withoutInteractiveFormatting
							disableLineBreaks
						/>

						{items.map(({ text }, i) => {
							return (
								<RichText
									key={i}
									placeholder={__('Item', 'eightshift-frontend-libs')}
									value={text}
									onChange={(value) => updateInnerItem(index, i, { text: value })}
									allowedFormats={[]}
									className={classNames?.link}
									onKeyDown={(event) => handleKeyDown(event, index, i, text)}
									withoutInteractiveFormatting
									disableLineBreaks
								/>
							);
						})}

						<Button
							size='small'
							icon={icons.add}
							tooltip={__('Add link', 'eightshift-frontend-libs')}
							onPress={({ target }) => {
								updateItem(index, {
									items: [...links[index].items, defaultLink],
								});

								setTimeout(() => {
									target?.previousElementSibling?.focus();
								}, 20);
							}}
						/>
					</div>
				);
			})}

			<Button
				onPress={({ target }) => {
					addSection();

					setTimeout(() => {
						target?.previousElementSibling?.querySelector('[contenteditable="true"]')?.focus();
					}, 20);
				}}
				icon={icons.add}
				tooltip={__('Add a section', 'eightshift-frontend-libs')}
				className='justify-self-start'
			>
				{__('Section', 'eightshift-frontend-libs')}
			</Button>
		</>
	);
};
