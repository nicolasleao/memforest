import type { Database } from "bun:sqlite";
import { searchHybrid } from "@memforest/mycelium";
import { ANSI, clearMainArea, writeAt } from "../render.js";
import type { TUIState } from "../types.js";
import { appendChatMessage } from "../types.js";

export async function handleChatInput(
	input: string,
	database: Database,
	state: TUIState,
): Promise<TUIState> {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		return state;
	}

	let updated = appendChatMessage(state, { role: "user", content: trimmed });

	const hybrid = await searchHybrid(database, trimmed, { limit: 5 });
	const results = hybrid.results;

	let response: string;
	if (results.length === 0) {
		response =
			'I don\'t have anything on that topic yet. Want to plant a note about it? Use: memforest upsert "tree/branch" "your content"';
	} else {
		const top = results[0];
		const snippet = top.branch.content.slice(0, 300).trim();
		const lines: string[] = [];
		lines.push(
			`I found ${results.length} related branch${results.length === 1 ? "" : "es"}. The most relevant is '${top.branch.frontmatter.title}' (score: ${top.score.toFixed(2)}, via: ${top.mode}). Here's what it says:`,
		);
		lines.push("");
		lines.push(`  ${snippet}${top.branch.content.length > 300 ? "..." : ""}`);

		if (results.length > 1) {
			lines.push("");
			lines.push("Other related branches:");
			for (const result of results.slice(1)) {
				lines.push(
					`  - ${result.branch.relativePath} (${result.score.toFixed(2)}, via: ${result.mode})`,
				);
			}
		}
		response = lines.join("\n");
	}

	updated = appendChatMessage(updated, { role: "euclid", content: response });
	return updated;
}

export function renderChatView(state: TUIState, rows: number, cols: number): void {
	const startRow = 3;
	const endRow = rows - 2;
	const availableRows = endRow - startRow;

	clearMainArea(startRow, endRow, cols);

	if (state.chatHistory.length === 0) {
		writeAt(
			startRow,
			2,
			`${ANSI.dim}Ask a question to search the forest. Type and press Enter.${ANSI.reset}`,
		);
		writeAt(startRow + 1, 2, `${ANSI.dim}Example: "authentication patterns"${ANSI.reset}`);
		return;
	}

	// Render chat history, scrolled to bottom
	const lines: Array<{ text: string; color: string }> = [];
	for (const msg of state.chatHistory) {
		if (msg.role === "user") {
			lines.push({ text: "", color: "" });
			lines.push({ text: `  You> ${msg.content}`, color: ANSI.cyan });
		} else {
			for (const line of msg.content.split("\n")) {
				lines.push({ text: `  ${line}`, color: ANSI.green });
			}
		}
	}

	const start = Math.max(0, lines.length - availableRows);
	const visible = lines.slice(start, start + availableRows);

	for (let i = 0; i < visible.length; i++) {
		const { text, color } = visible[i];
		const truncated = text.slice(0, cols - 2);
		writeAt(startRow + i, 1, `${color}${truncated}${ANSI.reset}`);
	}
}

export function formatChatResponse(
	results: Array<{
		branch: { frontmatter: { title: string }; content: string; relativePath: string };
		score: number;
		mode: string;
	}>,
): string {
	if (results.length === 0) {
		return 'I don\'t have anything on that topic yet. Want to plant a note about it? Use: memforest upsert "tree/branch" "your content"';
	}

	const top = results[0];
	const snippet = top.branch.content.slice(0, 300).trim();
	const lines: string[] = [];
	lines.push(
		`I found ${results.length} related branch${results.length === 1 ? "" : "es"}. The most relevant is '${top.branch.frontmatter.title}' (score: ${top.score.toFixed(2)}, via: ${top.mode}). Here's what it says:`,
	);
	lines.push("");
	lines.push(`  ${snippet}${top.branch.content.length > 300 ? "..." : ""}`);

	if (results.length > 1) {
		lines.push("");
		lines.push("Other related branches:");
		for (const result of results.slice(1)) {
			lines.push(
				`  - ${result.branch.relativePath} (${result.score.toFixed(2)}, via: ${result.mode})`,
			);
		}
	}
	return lines.join("\n");
}
