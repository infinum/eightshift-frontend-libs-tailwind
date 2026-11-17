export function unescapeCss(value) {
	return value.replace(/\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|(\r\n|[\n\f\r])|([\s\S]))/gi, (_, hex, newline, escaped) => {
		if (hex) {
			const code = Number.parseInt(hex, 16);

			return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? '\ufffd' : String.fromCodePoint(code);
		}

		return newline ? '' : escaped;
	});
}
