import * as readline from "node:readline";
import { createEuclidSession } from "@memforest/euclid";
import { MemforestError, resolveActiveTenant } from "@memforest/shared";
import { Markdown, type MarkdownTheme } from "@oh-my-pi/pi-tui";
import chalk from "chalk";
import type { Command } from "commander";

// ---------------------------------------------------------------------------
// Markdown theme for Euclid responses
// ---------------------------------------------------------------------------

const theme: MarkdownTheme = {
	heading: (t) => chalk.bold.cyan(t),
	link: (t) => chalk.underline.blue(t),
	linkUrl: (t) => chalk.dim(t),
	code: (t) => chalk.yellow(t),
	codeBlock: (t) => chalk.gray(t),
	codeBlockBorder: (t) => chalk.dim(t),
	quote: (t) => chalk.italic(t),
	quoteBorder: (_t) => chalk.dim("│"),
	hr: (t) => chalk.dim(t),
	listBullet: (t) => chalk.cyan(t),
	bold: (t) => chalk.bold(t),
	italic: (t) => chalk.italic(t),
	strikethrough: (t) => chalk.strikethrough(t),
	underline: (t) => chalk.underline(t),
	symbols: {
		cursor: "▌",
		inputCursor: "▌",
		boxRound: {
			topLeft: "╭",
			topRight: "╮",
			bottomLeft: "╰",
			bottomRight: "╯",
			horizontal: "─",
			vertical: "│",
		},
		boxSharp: {
			topLeft: "┌",
			topRight: "┐",
			bottomLeft: "└",
			bottomRight: "┘",
			horizontal: "─",
			vertical: "│",
			teeDown: "┬",
			teeUp: "┴",
			teeLeft: "┤",
			teeRight: "├",
			cross: "┼",
		},
		table: {
			topLeft: "┌",
			topRight: "┐",
			bottomLeft: "└",
			bottomRight: "┘",
			horizontal: "─",
			vertical: "│",
			teeDown: "┬",
			teeUp: "┴",
			teeLeft: "┤",
			teeRight: "├",
			cross: "┼",
		},
		quoteBorder: "│",
		hrChar: "─",
		spinnerFrames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
	},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderMarkdown(text: string, width: number): string {
	if (!text.trim()) return "";
	const md = new Markdown(text, 1, 0, theme);
	const lines = md.render(width);
	return lines.join("\n");
}

/** Extract tool info from a `tool_execution_start` event. */
function getToolStart(event: unknown): { name: string; display: string } | null {
	if (typeof event !== "object" || event === null) return null;
	const e = event as Record<string, unknown>;
	if (e.type !== "tool_execution_start") return null;

	const toolName = String(e.toolName ?? "tool");
	let display = toolName;

	if (typeof e.args === "object" && e.args !== null) {
		const args = e.args as Record<string, unknown>;
		// For bash-like tools, show the command being run
		if (typeof args.command === "string") {
			display = `${toolName}: ${args.command}`;
		}
	}

	return { name: toolName, display };
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function createSpinner(label: string) {
	let interval: ReturnType<typeof setInterval> | null = null;
	let frame = 0;

	return {
		start() {
			interval = setInterval(() => {
				const symbol = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
				process.stderr.write(`\r${chalk.cyan(symbol)} ${chalk.dim(label)}`);
				frame++;
			}, 80);
		},
		stop() {
			if (interval) {
				clearInterval(interval);
				interval = null;
				process.stderr.write("\r\x1b[2K"); // clear spinner line
			}
		},
	};
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerChat(program: Command): void {
	program
		.command("chat")
		.description("Start an interactive chat session with Euclid")
		.option("--model <model>", "Model to use (e.g., claude-sonnet-4-6, openai/gpt-4o)")
		.action(async (opts: { model?: string }) => {
			try {
				const tenant = resolveActiveTenant();
				const width = process.stdout.columns || 80;

				// Header
				const header = ` memforest v0.1.0 | Forest: ${tenant.name} `;
				process.stderr.write(`${chalk.bgBlue.white.bold(header.padEnd(width))}\n\n`);
				process.stderr.write(`${chalk.dim("Starting Euclid session...")}\n`);

				const euclidSession = await createEuclidSession({
					tenant,
					mode: "chat",
					model: opts.model,
				});

				process.stderr.write(
					`${chalk.dim("Euclid is ready. Type your message, or 'exit' to quit.")}\n\n`,
				);

				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stderr,
					prompt: chalk.green("euclid> "),
				});

				rl.prompt();

				rl.on("line", async (line) => {
					const input = line.trim();
					if (!input) {
						rl.prompt();
						return;
					}
					if (input === "exit" || input === "quit" || input === "/exit" || input === "/quit") {
						rl.close();
						return;
					}

					const spinner = createSpinner("Thinking...");
					spinner.start();

					// Subscribe to events — show tool calls while waiting
					const unsubscribe = euclidSession.subscribe((event: unknown) => {
						const tool = getToolStart(event);
						if (tool) {
							spinner.stop();
							process.stderr.write(`  ${chalk.dim(`⚙ ${tool.display}`)}\n`);
							spinner.start();
						}
					});

					try {
						const fullResponse = await euclidSession.prompt(input);
						unsubscribe();
						spinner.stop();

						if (fullResponse?.trim()) {
							const rendered = renderMarkdown(fullResponse, width - 2);
							process.stdout.write(`\n${rendered}\n\n`);
						}
					} catch (error) {
						unsubscribe();
						spinner.stop();
						process.stderr.write(
							chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}\n\n`),
						);
					}

					rl.prompt();
				});

				rl.on("close", async () => {
					process.stderr.write(`${chalk.dim("\nEnding Euclid session...")}\n`);
					await euclidSession.dispose();
				});
			} catch (error) {
				if (error instanceof MemforestError) {
					process.stderr.write(`${error.message}\n`);
					process.exit(1);
				}
				throw error;
			}
		});
}
