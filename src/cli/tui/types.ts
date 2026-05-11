import type { TenantContext } from "@memforest/shared";

export type TUIView = "chat" | "browse" | "graph" | "health";

export const TUI_VIEWS: TUIView[] = ["chat", "browse", "graph", "health"];

export interface ChatMessage {
	role: "user" | "euclid";
	content: string;
}

export interface BrowseItem {
	type: "tree" | "branch";
	name: string;
	treeName?: string;
	expanded?: boolean;
}

export interface TUIState {
	activeView: TUIView;
	tenant: TenantContext;
	chatHistory: ChatMessage[];
	selectedBranch: string | null;
	graphRoot: string | null;
	graphDepth: number;
	browseItems: BrowseItem[];
	browseIndex: number;
	branchContent: string | null;
	running: boolean;
}

export function createInitialState(tenant: TenantContext, initialView?: TUIView): TUIState {
	return {
		activeView: initialView ?? "chat",
		tenant,
		chatHistory: [],
		selectedBranch: null,
		graphRoot: null,
		graphDepth: 2,
		browseItems: [],
		browseIndex: 0,
		branchContent: null,
		running: true,
	};
}

export function cycleView(state: TUIState): TUIState {
	const currentIndex = TUI_VIEWS.indexOf(state.activeView);
	const nextIndex = (currentIndex + 1) % TUI_VIEWS.length;
	return { ...state, activeView: TUI_VIEWS[nextIndex] };
}

export function jumpToView(state: TUIState, view: TUIView): TUIState {
	return { ...state, activeView: view };
}

export function appendChatMessage(state: TUIState, message: ChatMessage): TUIState {
	return { ...state, chatHistory: [...state.chatHistory, message] };
}

export function setSelectedBranch(state: TUIState, branchPath: string | null): TUIState {
	return { ...state, selectedBranch: branchPath };
}

export function setGraphRoot(state: TUIState, root: string | null): TUIState {
	return { ...state, graphRoot: root };
}

export function setGraphDepth(state: TUIState, depth: number): TUIState {
	const clamped = Math.max(1, Math.min(3, depth));
	return { ...state, graphDepth: clamped };
}
