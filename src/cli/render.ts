import { Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// Markdown theme for Euclid responses
// ---------------------------------------------------------------------------

export const theme: MarkdownTheme = {
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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function renderMarkdown(text: string, width: number): Promise<string> {
	if (!text.trim()) return "";
	const md = new Markdown(text, 1, 0, theme);
	const lines = md.render(width);
	return lines.join("\n");
}

/** Extract tool info from a `tool_execution_start` event. */
export function getToolStart(event: unknown): { name: string; display: string } | null {
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

export function createSpinner(label: string) {
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
