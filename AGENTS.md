
## Formatting

Bun 1.4.4 or newer is required. Run commands from this package directory.

- `bun run fmt:check` is the authoritative, read-only formatting gate; it also runs before JavaScript linting.
- Agents must format only explicitly changed source files: `bun run fmt:files -- path/to/changed-file.js path/to/other-file.js`. Always supply file paths; no directories or broad globs. This command does not append the full source scope.
- `bun run fmt` formats the full configured source scope and requires explicit user approval. Never run it for routine changes.
- Use repository commands, not Prettier, editor formatters, or direct dependency formatters. Do not reformat unrelated files, tests, dependencies, generated output, public assets, or ext-player.
- Existing formatting violations remain blockers; do not hide them or bulk-fix them during tooling work.
