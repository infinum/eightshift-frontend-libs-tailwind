import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { createElement, createRef, forwardRef } from 'react';
import { renderToPipeableStream, renderToString } from 'react-dom/server';
import { createChunkedComponent } from '../scripts/helpers/chunked-component.js';

const render = (element) =>
	new Promise((resolve, reject) => {
		let html = '';
		const output = new Writable({
			write(chunk, _encoding, callback) {
				html += chunk.toString();
				callback();
			},
		});

		output.on('finish', () => resolve(html));
		output.on('error', reject);

		const stream = renderToPipeableStream(element, {
			onAllReady() {
				stream.pipe(output);
			},
			onError: reject,
		});
	});

test('lazy components forward object and callback refs with props', async () => {
	for (const ref of [createRef(), () => {}]) {
		let receivedRef;
		let loads = 0;
		const Field = forwardRef(({ label }, forwardedRef) => {
			receivedRef = forwardedRef;
			return createElement('div', null, label);
		});
		const ChunkedField = createChunkedComponent(() => {
			loads++;
			return Promise.resolve({ Field });
		}, 'Field');

		assert.equal(loads, 0);
		assert.match(await render(createElement(ChunkedField, { label: 'Name', ref })), /<div>Name<\/div>/);
		assert.equal(receivedRef, ref);
		assert.equal(loads, 1);
	}
});

test('lazy components still render regular function exports without a ref', async () => {
	const ChunkedLabel = createChunkedComponent(Promise.resolve({ default: ({ label }) => createElement('span', null, label) }), 'default');

	assert.match(await render(createElement(ChunkedLabel, { label: 'Ready' })), /<span>Ready<\/span>/);
});

test('infers nested chunked components and default forwardRef exports', async () => {
	let receivedRef;
	const Field = forwardRef(({ label }, ref) => {
		receivedRef = ref;
		return createElement('span', null, label);
	});
	const Inner = createChunkedComponent(Promise.resolve({ default: Field }));
	const Outer = createChunkedComponent(Promise.resolve({ Inner, __esModule: true }));
	const ref = createRef();

	assert.match(await render(createElement(Outer, { label: 'Nested', ref })), /<span>Nested<\/span>/);
	assert.equal(receivedRef, ref);
});

test('prefers the sole function export over forwardRef exports', async () => {
	const FunctionComponent = () => createElement('span', null, 'Function');
	const ForwardedComponent = forwardRef(() => createElement('span', null, 'Forwarded'));
	const Chunked = createChunkedComponent(Promise.resolve({ FunctionComponent, ForwardedComponent }));

	assert.match(await render(createElement(Chunked)), /<span>Function<\/span>/);
});

test('does not infer ambiguous function or forwardRef exports', async () => {
	const First = () => createElement('span');
	const Second = () => createElement('span');
	const ForwardedFirst = forwardRef(First);
	const ForwardedSecond = forwardRef(Second);

	for (const exports of [{ First, Second, ForwardedFirst }, { ForwardedFirst, ForwardedSecond }]) {
		const Chunked = createChunkedComponent(Promise.resolve(exports));

		await assert.rejects(render(createElement(Chunked)), /Unable to resolve chunked component/);
	}
});

test('lazy components keep the configured fallback while loading', () => {
	const pending = new Promise(() => {});
	const ChunkedLabel = createChunkedComponent(() => pending, 'default', createElement('span', null, 'Loading'));

	assert.match(renderToString(createElement(ChunkedLabel)), /<span>Loading<\/span>/);
});
