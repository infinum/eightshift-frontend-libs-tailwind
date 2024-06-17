import { unescapeHTML } from '../helpers/text-helpers';

/**
 * Returns a function that fetches data from WordPress REST API.
 *
 * @param {string} endpoint - Endpoint to fetch from.
 * @param {Object} options - Additional options.
 * @param {Function} [options.processId] - Function to process the ID. `(itemData: Object) => id: string | Number`
 * @param {Function} [options.processLabel] - Function to process the label. `(itemData: Object) => label: string`
 * @param {Function} [options.processMetadata] - Function to process the metadata. `(itemData: Object) => metadata: Object`
 * @param {number} [options.perPage=30] - Number of items to fetch per page.
 * @param {string} [options.urlBase='<origin>/wp-json'] - Base URL for the API.
 * @param {string} [options.routePrefix='wp/v2'] - Route prefix for the API.
 * @param {string} [options.fields='id,title'] - A comma-separated list of field names to fetch from the API. Good to include as it makes the query faster and the output terser.
 * @param {SearchColumnsConfig} [options.searchColumns] - Allows narrowing the search scope.
 * @param {boolean} [options.noUnescapeTitle] - If `true`, the post title will not unescape HTML entities.
 *
 * @returns {Function} The `(searchText, [abortSignal]) => Promise` function.
 *
 * @typedef {'post_title' | 'post_excerpt' | 'post_content'} SearchColumnsConfig
 *
 * @example
 * const fetchFn = getFetchWpApi('pages');
 * const data = await fetchFn('search text');
 * const json = await data.json();
 *
 * console.log(json);
 *
 * @example
 * <LinkInput
 *  value={buttonUrl}
 *  onChange={({url}) => setAttributes({ [getAttrKey('buttonUrl', attributes, manifest)]: url })}
 *  fetchSuggestions={getFetchWpApi('search')}
 * />
 *
 */
export function fetchFromWpRest(endpoint, options = {}) {
	const {
		processId = ({ id }) => id,
		processLabel = ({ title }) => unescapeHTML(title),
		processMetadata = () => null,
		perPage = 30,
		urlBase = `${window.location.origin}/wp-json`,
		routePrefix = 'wp/v2',
		fields = 'id,title',
		searchColumns,
		noUnescapeTitle = false,
		...params
	} = options;

	return async (searchText = '', abortSignal) => {
		const url = new URL(`${urlBase}/${routePrefix}/${endpoint}/`);

		url.searchParams.append('per_page', perPage);

		if (fields?.length > 0) {
			url.searchParams.append('_fields', fields);
		}

		if (searchColumns?.length > 0) {
			url.searchParams.append('search_columns', Array.isArray(searchColumns) ? searchColumns.join(',') : searchColumns);
		}

		if (Object.keys(params).length > 0) {
			for (const [key, value] of Object.entries(params)) {
				url.searchParams.append(key, value);
			}
		}

		if (searchText?.length > 0) {
			url.searchParams.append('search', searchText);
		}

		const newData = await fetch(url.toString(), {
			signal: abortSignal,
		});

		const newDataJson = await newData.json();

		return [...newDataJson].map((item) => {
			return {
				label: noUnescapeTitle ? unescapeHTML(processLabel(item)) : processLabel(item),
				value: processId(item),
				metadata: processMetadata(item),
			};
		});
	};
}

export const wpSearchRoute = fetchFromWpRest('search', {
	processId: ({ url }) => url,
	processLabel: ({ title }) => title,
	processMetadata: ({ type, subtype }) => ({ type, subtype }),
	additionalParam: {
		type: 'post',
		_locale: 'user',
		per_page: 5,
	},
	noCache: true,
	searchColumns: 'post_title',
	fields: 'id,title,type,subtype,url',
});
