import { useForest } from "@memforest/forest";
import { MemforestError } from "@memforest/shared";
import type { Command } from "commander";

export function registerUse(program: Command): void {
	program
		.command("use")
		.description("Set the active forest")
		.argument("<name>", "Forest name")
		.action(async (name: string) => {
			try {
				useForest(name);
				process.stderr.write(`Active forest set to '${name}'\n`);
			} catch (error) {
				if (error instanceof MemforestError) {
					process.stderr.write(`${error.message}\n`);
					process.exit(1);
				}
				throw error;
			}
		});
}
