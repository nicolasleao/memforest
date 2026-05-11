import * as readline from "node:readline";
import { closeDatabase, openDatabase } from "@memforest/mycelium";
import type { HealthReport, TenantContext } from "@memforest/shared";
import { ANSI, drawFooter, drawHeader, getTerminalSize, moveTo, writeAt } from "./render.js";
import type { TUIView } from "./types.js";
import { TUI_VIEWS, createInitialState, cycleView, jumpToView } from "./types.js";
import { handleBrowseNavigation, loadBrowseItems, renderBrowseView } from "./views/browse.js";
import { handleChatInput, renderChatView } from "./views/chat.js";
import { handleGraphNavigation, renderGraphView } from "./views/graph.js";
import { computeHealthReport, renderHealthView } from "./views/health.js";

export async function launchTUI(tenant: TenantContext, initialView?: TUIView): Promise<void> {
	const db = openDatabase(tenant);

	let state = createInitialState(tenant, initialView);
	state = { ...state, browseItems: loadBrowseItems(tenant) };

	let inputMode = false;
	let inputBuffer = "";
	let healthReport: HealthReport | null = null;
	let graphSelectedIndex = 0;
	let graphNavigableItems: string[] = [];

	// Set raw mode for keyboard input
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}
	readline.emitKeypressEvents(process.stdin);
	process.stdin.resume();

	// Hide cursor and clear screen
	process.stdout.write(ANSI.hideCursor);
	process.stdout.write(ANSI.clearScreen);

	function render(): void {
		const { rows, cols } = getTerminalSize();

		drawHeader(state.tenant.name, state.activeView, cols);
		drawFooter(state.activeView, cols, rows, inputMode);

		switch (state.activeView) {
			case "chat":
				renderChatView(state, rows, cols);
				if (inputMode) {
					const prompt = `  You> ${inputBuffer}`;
					writeAt(rows - 2, 1, ANSI.clearLine);
					writeAt(rows - 2, 1, `${ANSI.cyan}${prompt}${ANSI.reset}`);
				} else if (state.chatHistory.length > 0) {
					writeAt(rows - 2, 1, ANSI.clearLine);
					writeAt(rows - 2, 2, `${ANSI.dim}Press / to type a query${ANSI.reset}`);
				}
				break;
			case "browse":
				renderBrowseView(state, rows, cols);
				break;
			case "graph":
				graphNavigableItems = renderGraphView(state, rows, cols, db, graphSelectedIndex);
				break;
			case "health":
				if (!healthReport) {
					healthReport = computeHealthReport(db, state.tenant);
				}
				renderHealthView(healthReport, state.tenant.name, rows, cols);
				break;
		}
	}

	function cleanup(): void {
		process.stdout.write(ANSI.showCursor);
		process.stdout.write(ANSI.clearScreen);
		moveTo(1, 1);
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(false);
		}
		process.stdin.pause();
		closeDatabase(db);
	}

	function quit(): void {
		state = { ...state, running: false };
		cleanup();
		process.exit(0);
	}

	render();

	process.stdin.on("keypress", async (_str: string | undefined, key: readline.Key) => {
		if (!state.running) return;

		// Ctrl+C always quits
		if (key.ctrl && key.name === "c") {
			quit();
			return;
		}

		// Input mode handling (chat)
		if (inputMode) {
			if (key.name === "escape") {
				inputMode = false;
				inputBuffer = "";
				render();
				return;
			}
			if (key.name === "return") {
				if (inputBuffer.trim().length > 0) {
					const query = inputBuffer;
					inputBuffer = "";
					inputMode = false;

					// Show searching indicator
					const { rows } = getTerminalSize();
					writeAt(rows - 2, 1, ANSI.clearLine);
					writeAt(rows - 2, 2, `${ANSI.dim}Searching...${ANSI.reset}`);

					state = await handleChatInput(query, db, state);
					render();
				}
				return;
			}
			if (key.name === "backspace") {
				inputBuffer = inputBuffer.slice(0, -1);
				render();
				return;
			}
			// Regular character input
			if (_str && !key.ctrl && !key.meta) {
				inputBuffer += _str;
				render();
			}
			return;
		}

		// Global keybindings (non-input mode)
		if (key.name === "q") {
			quit();
			return;
		}

		if (key.name === "tab") {
			state = cycleView(state);
			graphSelectedIndex = 0;
			render();
			return;
		}

		// Number keys to jump views
		const numKey = _str;
		if (numKey && numKey >= "1" && numKey <= "4") {
			const viewIndex = Number.parseInt(numKey, 10) - 1;
			state = jumpToView(state, TUI_VIEWS[viewIndex]);
			graphSelectedIndex = 0;
			render();
			return;
		}

		// View-specific keybindings
		switch (state.activeView) {
			case "chat": {
				if (key.name === "slash" || _str === "/") {
					inputMode = true;
					inputBuffer = "";
					render();
				}
				break;
			}
			case "browse": {
				if (key.name === "up") {
					state = handleBrowseNavigation("up", state);
					render();
				} else if (key.name === "down") {
					state = handleBrowseNavigation("down", state);
					render();
				} else if (key.name === "return") {
					state = handleBrowseNavigation("enter", state);
					render();
				}
				break;
			}
			case "graph": {
				if (key.name === "up") {
					const result = handleGraphNavigation(
						"up",
						db,
						state,
						graphNavigableItems,
						graphSelectedIndex,
					);
					state = result.state;
					graphSelectedIndex = result.selectedIndex;
					render();
				} else if (key.name === "down") {
					const result = handleGraphNavigation(
						"down",
						db,
						state,
						graphNavigableItems,
						graphSelectedIndex,
					);
					state = result.state;
					graphSelectedIndex = result.selectedIndex;
					render();
				} else if (key.name === "return") {
					const result = handleGraphNavigation(
						"enter",
						db,
						state,
						graphNavigableItems,
						graphSelectedIndex,
					);
					state = result.state;
					graphSelectedIndex = result.selectedIndex;
					render();
				} else if (_str === "+" || _str === "=") {
					const result = handleGraphNavigation(
						"+",
						db,
						state,
						graphNavigableItems,
						graphSelectedIndex,
					);
					state = result.state;
					graphSelectedIndex = result.selectedIndex;
					render();
				} else if (_str === "-") {
					const result = handleGraphNavigation(
						"-",
						db,
						state,
						graphNavigableItems,
						graphSelectedIndex,
					);
					state = result.state;
					graphSelectedIndex = result.selectedIndex;
					render();
				}
				break;
			}
			case "health": {
				if (key.name === "r" || _str === "r") {
					healthReport = computeHealthReport(db, state.tenant);
					render();
				}
				break;
			}
		}
	});

	// Handle terminal resize
	process.stdout.on("resize", () => {
		process.stdout.write(ANSI.clearScreen);
		render();
	});

	// Return a promise that resolves when quit
	return new Promise<void>((resolve) => {
		const interval = setInterval(() => {
			if (!state.running) {
				clearInterval(interval);
				resolve();
			}
		}, 100);
	});
}
