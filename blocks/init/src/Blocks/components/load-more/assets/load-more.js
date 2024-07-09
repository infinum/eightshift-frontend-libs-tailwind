/* global esBlocksLocalization */

export class LoadMore {
	constructor({ element }) {
		this.element = element;

		this.restUrl = esBlocksLocalization?.loadMoreRestUrl ?? '';

		// Classes.
		this.CLASS_IS_HIDDEN = 'hidden';

		// Data attributes.
		this.ATTR_PER_PAGE_OVERRIDE = 'data-load-more-per-page-override';
		this.ATTR_INITIAL_ITEMS = 'data-load-more-initial-items';
		this.ATTR_QUERY = 'data-load-more-query';
		this.ATTR_TYPE = 'data-load-more-type';
		this.ATTR_ID = 'data-load-more-id';
		this.ATTR_PAGE = 'data-load-more-page';

		// Query vars.
		this.QUERY_VAR = 'current-page';

		// Internal data.
		this.page = this.element.getAttribute(this.ATTR_PAGE) ?? 1;
		this.query = this.element.getAttribute(this.ATTR_QUERY);
		this.loadFromQueryParam = false;
	}

	/**
	 * Init all event-listeners.
	 */
	init() {
		const container = document.querySelector(`#${this.element.getAttribute(this.ATTR_ID)}`);

		// this.updateCurrentPageFromQuery();

		// Initialize params.
		const initialItems = this.element.getAttribute(this.ATTR_INITIAL_ITEMS);
		const type = this.element.getAttribute(this.ATTR_TYPE);
		const perPageOverride = this.element.getAttribute(this.ATTR_PER_PAGE_OVERRIDE);

		const params = {
			initialItems: initialItems,
			type: type,
			perPageOverride: perPageOverride,
		};

		// Add listener on trigger click.
		this.element.addEventListener('click', async () => {
			this.element.disabled = true;

			// Get data.
			const received = await this.fetchData({
				...params,
				query: this.query,
				currentPage: this.page,
			});

			// Disable 'Load more' button if something went wrong.
			if (!received || !received?.success) {
				this.element.disabled = true;

				return;
			}

			const { currentPage, query, maxPages, body } = received.data;

			// Update local params.
			this.query = query;
			this.page = currentPage;

			this.setCurrentPageQueryParam(currentPage);

			// Add new items in a staggered manner.
			body.split('<a').forEach((item, i) => {
				setTimeout(() => {
					container.insertAdjacentHTML('beforeend', `<a${item}`);
				}, i * 150);
			});

			// Hide button if at the end, otherwise re-enable it.
			if (currentPage >= maxPages || maxPages === 0 || currentPage === 0) {
				this.element.classList.add(this.CLASS_IS_HIDDEN);
			} else {
				this.element.disabled = false;
			}
		});
	}

	fetchData = async (params) => {
		// Construct URL.
		const url = new URL(this.restUrl);

		Object.entries(params).forEach(([key, value]) => {
			url.searchParams.append(key, value);
		});

		if (this.loadFromQueryParam) {
			this.loadFromQueryParam = false;
			url.searchParams.set('urlLoadMoreAction', 'true');
		}

		// Fetch data.
		const response = await fetch(url.toString(), {
			method: 'GET',
			mode: 'same-origin',
			headers: {
				Accept: 'application/json',
			},
			credentials: 'same-origin',
			redirect: 'follow',
			referrer: 'no-referrer',
		});

		if (!response.ok) {
			return null;
		}

		return await response.json();
	};

	updateCurrentPageFromQuery = () => {
		const url = new URL(window.location);

		const param = parseInt(url.searchParams.get(this.QUERY_VAR));

		if (isNaN(param) || param < 1) {
			return;
		}

		this.page = param;
		this.loadFromQueryParam = true;
	};

	setCurrentPageQueryParam = (page) => {
		if (!('URLSearchParams' in window)) {
			return;
		}

		const url = new URL(window.location);

		url.searchParams.set(this.QUERY_VAR, page ?? this.page);

		history.replaceState(null, '', url);
	};
}
