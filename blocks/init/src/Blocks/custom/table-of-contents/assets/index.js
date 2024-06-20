import domReady from '@wordpress/dom-ready';

domReady(async () => {
	const tocBlocks = document.querySelectorAll('.js-block-table-of-contents');

	if (tocBlocks?.length < 1) {
		return;
	}

	tocBlocks.forEach((tocBlock) => {
		const levelsToUse = tocBlock?.dataset?.levels ?? 'h1,h2,h3,h4,h5,h6';

		const headings = document.querySelectorAll(`.main-content :where(${levelsToUse})`);

		headings.forEach((heading) => {
			const entry = document.createElement('button');
			entry.className = 'block py-0.5 focus:outline-none group';

			const itemClassName =
				'transition text-sm rounded group-hover:bg-navy-100 group-hover:ring-4 group-hover:ring-navy-100 group-hover:text-navy-950 group-focus-visible:bg-navy-950 group-focus-visible:ring-4 group-focus-visible:ring-navy-950 group-focus-visible:text-navy-50';

			let preText = '';
			const dash = '&ndash;';

			const dashClassName = 'text-gray-300 mr-1.5 tracking-tighter';

			switch (heading.tagName.toLowerCase()) {
				case 'h2':
					preText = `<span class="${dashClassName}">${dash}</span>`;
					break;
				case 'h3':
					preText = `<span class="${dashClassName}">${dash.repeat(2)}</span>`;
					break;
				case 'h4':
					preText = `<span class="${dashClassName}">${dash.repeat(3)}</span>`;
					break;
				case 'h5':
					preText = `<span class="${dashClassName}">${dash.repeat(4)}</span>`;
					break;
				case 'h6':
					preText = `<span class="${dashClassName}">${dash.repeat(5)}</span>`;
					break;
			}

			entry.innerHTML = `${preText}<span class="${itemClassName}${heading.tagName.toLowerCase() !== 'h1' ? 'px-0.5' : ''}">${heading.innerText}</span>`;

			entry.addEventListener('click', () => {
				heading.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
					inline: 'start',
				});
			});

			tocBlock.appendChild(entry);
		});
	});
});
