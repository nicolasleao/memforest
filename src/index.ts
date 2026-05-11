import { createProgram } from "./cli/index.js";

const program = createProgram();

// No args + TTY → launch TUI
const userArgs = process.argv.slice(2);
if (userArgs.length === 0 && process.stdin.isTTY && process.stdout.isTTY) {
	// Inject "tui" subcommand
	program.parse(["node", "memforest", "tui"]);
} else {
	program.parse(process.argv);
}
