const pureJsxCompatible = new WeakMap();

// Only audited built-ins may participate; plugin names are not a trust boundary.
export function allowPureJsxGrouping(plugin) {
	pureJsxCompatible.set(plugin, plugin.setup);
	return plugin;
}

export function supportsPureJsxGrouping(plugin) {
	return pureJsxCompatible.has(plugin) && pureJsxCompatible.get(plugin) === plugin.setup;
}
