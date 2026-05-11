import { Command } from "commander";
import { registerAsk } from "./commands/ask.js";
import { registerHealth } from "./commands/health.js";
import { registerInit } from "./commands/init.js";
import { registerList } from "./commands/list.js";
import { registerReindex } from "./commands/reindex.js";
import { registerSearch } from "./commands/search.js";
import { registerTui } from "./commands/tui.js";
import { registerUpsert } from "./commands/upsert.js";
import { registerUse } from "./commands/use.js";

export function createProgram(): Command {
	const program = new Command()
		.name("memforest")
		.version("0.1.0")
		.description("Multi-tenant, agent-native memory substrate");

	registerInit(program);
	registerList(program);
	registerUse(program);
	registerUpsert(program);
	registerSearch(program);
	registerAsk(program);
	registerHealth(program);
	registerReindex(program);
	registerTui(program);

	return program;
}
