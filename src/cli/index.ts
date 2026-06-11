import { Command } from "commander";
import { registerAsk } from "./commands/ask.js";
import { registerChat } from "./commands/chat.js";
import { registerHealth } from "./commands/health.js";
import { registerInit } from "./commands/init.js";
import { registerList } from "./commands/list.js";
import { registerMaintain } from "./commands/maintain.js";
import { registerReindex } from "./commands/reindex.js";
import { registerSearch } from "./commands/search.js";
import { registerUpsert } from "./commands/upsert.js";
import { registerUse } from "./commands/use.js";

export function createProgram(): Command {
	const program = new Command()
		.name("memforest")
		.version("0.1.0")
		.description("Multi-tenant, agent-native memory substrate")
		.option(
			"-f, --forest <name>",
			"Operate on this forest for this invocation (overrides the active forest)",
		);

	registerInit(program);
	registerList(program);
	registerUse(program);
	registerUpsert(program);
	registerSearch(program);
	registerAsk(program);
	registerHealth(program);
	registerReindex(program);
	registerChat(program);
	registerMaintain(program);

	program.action(async () => {
		const chatCmd = program.commands.find((c) => c.name() === "chat");
		if (chatCmd) {
			await chatCmd.parseAsync([], { from: "user" });
		}
	});

	return program;
}
