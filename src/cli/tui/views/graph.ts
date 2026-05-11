import type { Database } from "bun:sqlite";
import { searchGraph } from "@memforest/mycelium";
import { ANSI, clearMainArea, writeAt } from "../render.js";
import type { TUIState } from "../types.js";
import { setGraphDepth, setGraphRoot } from "../types.js";

interface GraphNeighborhood {
	root: string;
	outbound: string[];
	inbound: string[];
	extended: Array<{ path: string; hops: number }>;
}

export function loadGraphNeighborhood(
	database: Database,
	rootPath: string,
	depth: number,
): GraphNeighborhood {
	const outboundRows = database
		.prepare("SELECT target_path FROM edges WHERE source_path = ?")
		.all(rootPath) as { target_path: string }[];

	const inboundRows = database
		.prepare("SELECT source_path FROM edges WHERE target_path = ?")
		.all(rootPath) as { source_path: string }[];

	const outbound = outboundRows.map((r) => r.target_path);
	const inbound = inboundRows.map((r) => r.source_path);

	// For 2+ hops, use searchGraph
	const extended: Array<{ path: string; hops: number }> = [];
	if (depth >= 2) {
		const graphResults = searchGraph(database, rootPath, depth);
		const directNeighbors = new Set([...outbound, ...inbound]);

		for (const result of graphResults) {
			const p = result.branch.relativePath;
			if (!directNeighbors.has(p) && p !== rootPath) {
				// Estimate hops from score: score = 1 / (hop + 1)
				const estimatedHops = Math.round(1 / result.score - 1);
				extended.push({ path: p, hops: Math.max(2, estimatedHops) });
			}
		}
	}

	return { root: rootPath, outbound, inbound, extended };
}

export function handleGraphNavigation(
	key: string,
	_database: Database,
	state: TUIState,
	navigableItems: string[],
	selectedIndex: number,
): { state: TUIState; selectedIndex: number } {
	switch (key) {
		case "up": {
			const newIndex = Math.max(0, selectedIndex - 1);
			return { state, selectedIndex: newIndex };
		}
		case "down": {
			const newIndex = Math.min(navigableItems.length - 1, selectedIndex + 1);
			return { state, selectedIndex: newIndex };
		}
		case "enter": {
			if (navigableItems.length > 0 && selectedIndex < navigableItems.length) {
				const newRoot = navigableItems[selectedIndex];
				const updated = setGraphRoot(state, newRoot);
				return { state: { ...updated, selectedBranch: newRoot }, selectedIndex: 0 };
			}
			return { state, selectedIndex };
		}
		case "+":
		case "=": {
			return { state: setGraphDepth(state, state.graphDepth + 1), selectedIndex };
		}
		case "-": {
			return { state: setGraphDepth(state, state.graphDepth - 1), selectedIndex };
		}
		default:
			return { state, selectedIndex };
	}
}

export function renderGraphView(
	state: TUIState,
	rows: number,
	cols: number,
	database: Database,
	selectedIndex: number,
): string[] {
	const startRow = 3;
	const endRow = rows - 2;
	const availableRows = endRow - startRow;

	clearMainArea(startRow, endRow, cols);

	const root = state.graphRoot ?? state.selectedBranch;
	if (!root) {
		writeAt(
			startRow,
			2,
			`${ANSI.dim}No branch selected. Browse and select a branch first, or use the browse view.${ANSI.reset}`,
		);
		return [];
	}

	const neighborhood = loadGraphNeighborhood(database, root, state.graphDepth);
	const navigableItems: string[] = [];

	let line = 0;

	// Root
	writeAt(startRow + line, 2, `${ANSI.bold}${ANSI.cyan}[${neighborhood.root}]${ANSI.reset}`);
	writeAt(startRow + line, cols - 15, `${ANSI.dim}depth: ${state.graphDepth}${ANSI.reset}`);
	line++;

	// Outbound links
	if (neighborhood.outbound.length > 0) {
		writeAt(startRow + line, 4, `${ANSI.green}\u2192 links to:${ANSI.reset}`);
		line++;
		for (const target of neighborhood.outbound) {
			if (line >= availableRows) break;
			navigableItems.push(target);
			const idx = navigableItems.length - 1;
			const marker = idx === selectedIndex ? `${ANSI.inverse}` : "";
			const reset = idx === selectedIndex ? `${ANSI.reset}` : "";
			writeAt(startRow + line, 6, `${marker}${target}${reset}`);
			line++;
		}
	} else {
		writeAt(startRow + line, 4, `${ANSI.dim}\u2192 links to: (none)${ANSI.reset}`);
		line++;
	}

	// Inbound links
	if (neighborhood.inbound.length > 0) {
		writeAt(startRow + line, 4, `${ANSI.yellow}\u2190 linked from:${ANSI.reset}`);
		line++;
		for (const source of neighborhood.inbound) {
			if (line >= availableRows) break;
			navigableItems.push(source);
			const idx = navigableItems.length - 1;
			const marker = idx === selectedIndex ? `${ANSI.inverse}` : "";
			const reset = idx === selectedIndex ? `${ANSI.reset}` : "";
			writeAt(startRow + line, 6, `${marker}${source}${reset}`);
			line++;
		}
	} else {
		writeAt(startRow + line, 4, `${ANSI.dim}\u2190 linked from: (none)${ANSI.reset}`);
		line++;
	}

	// Extended (2+ hops)
	if (neighborhood.extended.length > 0) {
		const groupedByHop = new Map<number, string[]>();
		for (const item of neighborhood.extended) {
			const existing = groupedByHop.get(item.hops) ?? [];
			existing.push(item.path);
			groupedByHop.set(item.hops, existing);
		}

		for (const [hops, paths] of [...groupedByHop.entries()].sort((a, b) => a[0] - b[0])) {
			if (line >= availableRows) break;
			writeAt(startRow + line, 4, `${ANSI.magenta}\u2500\u2500 ${hops} hops:${ANSI.reset}`);
			line++;
			for (const p of paths) {
				if (line >= availableRows) break;
				navigableItems.push(p);
				const idx = navigableItems.length - 1;
				const marker = idx === selectedIndex ? `${ANSI.inverse}` : "";
				const reset = idx === selectedIndex ? `${ANSI.reset}` : "";
				writeAt(startRow + line, 6, `${marker}${p}${reset}`);
				line++;
			}
		}
	}

	return navigableItems;
}
