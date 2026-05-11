import { listBranches, readBranch } from "@memforest/forest";
import type { TenantContext } from "@memforest/shared";
import { ANSI, clearMainArea, writeAt } from "../render.js";
import type { BrowseItem, TUIState } from "../types.js";

export function loadBrowseItems(tenant: TenantContext): BrowseItem[] {
	const branches = listBranches(tenant);
	const treeMap = new Map<string, string[]>();

	for (const branch of branches) {
		const existing = treeMap.get(branch.treeName) ?? [];
		existing.push(branch.branchName);
		treeMap.set(branch.treeName, existing);
	}

	const items: BrowseItem[] = [];
	const treeNames = [...treeMap.keys()].sort();

	for (const treeName of treeNames) {
		items.push({ type: "tree", name: treeName, expanded: false });
	}

	return items;
}

export function handleBrowseNavigation(key: string, state: TUIState): TUIState {
	const items = state.browseItems;
	if (items.length === 0) {
		return state;
	}

	switch (key) {
		case "up": {
			const newIndex = Math.max(0, state.browseIndex - 1);
			return { ...state, browseIndex: newIndex };
		}
		case "down": {
			const newIndex = Math.min(items.length - 1, state.browseIndex + 1);
			return { ...state, browseIndex: newIndex };
		}
		case "enter": {
			const current = items[state.browseIndex];
			if (current.type === "tree") {
				if (current.expanded) {
					// Collapse: remove branch items belonging to this tree
					const collapsed = items.filter(
						(item, i) =>
							i === state.browseIndex || item.type !== "branch" || item.treeName !== current.name,
					);
					collapsed[state.browseIndex] = { ...current, expanded: false };
					return { ...state, browseItems: collapsed };
				}
				// Expand: insert branch items after this tree
				const branches = listBranches(state.tenant, current.name);
				const branchItems: BrowseItem[] = branches.map((b) => ({
					type: "branch" as const,
					name: b.branchName,
					treeName: current.name,
				}));
				const expanded = [...items];
				expanded[state.browseIndex] = { ...current, expanded: true };
				expanded.splice(state.browseIndex + 1, 0, ...branchItems);
				return { ...state, browseItems: expanded };
			}
			// Branch selected — load content
			if (current.treeName) {
				try {
					const branch = readBranch(state.tenant, current.treeName, current.name);
					const path = `${current.treeName}/${current.name}`;
					return {
						...state,
						selectedBranch: path,
						branchContent: formatBranchContent(branch),
					};
				} catch {
					return state;
				}
			}
			return state;
		}
		default:
			return state;
	}
}

function formatBranchContent(branch: {
	frontmatter: {
		title: string;
		status: string;
		tags: string[];
		created: string;
		updated: string;
	};
	content: string;
}): string {
	const lines: string[] = [];
	lines.push(`Title: ${branch.frontmatter.title}`);
	lines.push(`Status: ${branch.frontmatter.status}`);
	lines.push(`Tags: ${branch.frontmatter.tags.join(", ") || "(none)"}`);
	lines.push(`Created: ${branch.frontmatter.created.slice(0, 10)}`);
	lines.push(`Updated: ${branch.frontmatter.updated.slice(0, 10)}`);
	lines.push("─".repeat(40));
	lines.push(branch.content);
	return lines.join("\n");
}

export function renderBrowseView(state: TUIState, rows: number, cols: number): void {
	const startRow = 3;
	const endRow = rows - 2;
	const availableRows = endRow - startRow;

	clearMainArea(startRow, endRow, cols);

	const items = state.browseItems;
	if (items.length === 0) {
		writeAt(
			startRow,
			2,
			`${ANSI.dim}No branches found. Create some with: memforest upsert${ANSI.reset}`,
		);
		return;
	}

	// Left panel: item list (40% width)
	const leftWidth = Math.floor(cols * 0.4);
	const rightStart = leftWidth + 2;
	const rightWidth = cols - rightStart - 1;

	// Scroll the list if needed
	let scrollOffset = 0;
	if (state.browseIndex >= availableRows) {
		scrollOffset = state.browseIndex - availableRows + 1;
	}

	for (let i = 0; i < availableRows && i + scrollOffset < items.length; i++) {
		const itemIndex = i + scrollOffset;
		const item = items[itemIndex];
		const isSelected = itemIndex === state.browseIndex;
		const prefix = isSelected ? `${ANSI.inverse}` : "";
		const suffix = isSelected ? `${ANSI.reset}` : "";

		let label: string;
		if (item.type === "tree") {
			const arrow = item.expanded ? "\u25BC" : "\u25B6";
			label = ` ${arrow} ${item.name}/`;
		} else {
			label = `   ${item.name}`;
		}

		const truncated = label.slice(0, leftWidth - 1).padEnd(leftWidth - 1);
		writeAt(startRow + i, 2, `${prefix}${truncated}${suffix}`);
	}

	// Divider
	for (let r = startRow; r < endRow; r++) {
		writeAt(r, leftWidth + 1, `${ANSI.dim}\u2502${ANSI.reset}`);
	}

	// Right panel: content
	if (state.branchContent) {
		const contentLines = state.branchContent.split("\n");
		for (let i = 0; i < availableRows && i < contentLines.length; i++) {
			const line = contentLines[i].slice(0, rightWidth);
			writeAt(startRow + i, rightStart, line);
		}
	} else {
		writeAt(startRow, rightStart, `${ANSI.dim}Select a branch to view its content${ANSI.reset}`);
	}
}
