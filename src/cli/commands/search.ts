import {
	closeDatabase,
	openDatabase,
	searchFTS,
	searchGraph,
	searchHybrid,
} from "@memforest/mycelium";
import { MemforestError, resolveActiveTenant } from "@memforest/shared";
import type { SearchResult } from "@memforest/shared";
import type { Command } from "commander";

export function registerSearch(program: Command): void {
	program
		.command("search")
		.description("Search the active forest")
		.argument("<query>", "Search query")
		.option("-m, --mode <mode>", "Search mode: fts|graph|hybrid", "hybrid")
		.option("-l, --limit <n>", "Max results", "10")
		.option("--json", "Output as JSON")
		.action(
			async (
				query: string,
				opts: { mode: string; limit: string; json?: boolean },
				command: Command,
			) => {
				try {
					const tenant = resolveActiveTenant(
						command.optsWithGlobals().forest as string | undefined,
					);
					const db = openDatabase(tenant);
					const limit = Number.parseInt(opts.limit, 10);

					try {
						let results: SearchResult[];

						switch (opts.mode) {
							case "fts":
								results = await searchFTS(db, query, limit);
								break;
							case "graph":
								results = searchGraph(db, query, limit);
								break;
							case "hybrid": {
								const hybrid = await searchHybrid(db, query, { limit });
								results = hybrid.results;
								break;
							}
							default:
								process.stderr.write(
									`Unknown search mode '${opts.mode}'. Use fts, graph, or hybrid.\n`,
								);
								process.exit(1);
								return;
						}

						if (results.length === 0) {
							process.stderr.write(`No results found for '${query}'\n`);
							return;
						}

						if (opts.json) {
							process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
						} else {
							const header = `${"SCORE".padEnd(8)}${"MODE".padEnd(8)}${"PATH".padEnd(30)}TITLE`;
							process.stdout.write(`${header}\n`);
							for (const result of results) {
								const line = `${result.score.toFixed(2).padEnd(8)}${result.mode.padEnd(8)}${result.branch.relativePath.padEnd(30)}${result.branch.frontmatter.title}`;
								process.stdout.write(`${line}\n`);
							}
						}
					} finally {
						closeDatabase(db);
					}
				} catch (error) {
					if (error instanceof MemforestError) {
						process.stderr.write(`${error.message}\n`);
						process.exit(1);
					}
					throw error;
				}
			},
		);
}
