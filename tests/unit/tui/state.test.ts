import type { TenantContext } from "@memforest/shared";
import { describe, expect, it } from "vitest";
import {
	type ChatMessage,
	appendChatMessage,
	createInitialState,
	cycleView,
	jumpToView,
	setGraphDepth,
	setGraphRoot,
	setSelectedBranch,
} from "../../../src/cli/tui/types.js";

const mockTenant: TenantContext = {
	name: "test-forest",
	forestPath: "/tmp/test",
	treesPath: "/tmp/test/trees",
	databasePath: "/tmp/test/mycelium.db",
	configPath: "/tmp/test/forest.toml",
};

describe("TUI State Management", () => {
	describe("createInitialState", () => {
		it("creates state with default chat view", () => {
			const state = createInitialState(mockTenant);
			expect(state.activeView).toBe("chat");
			expect(state.tenant).toBe(mockTenant);
			expect(state.chatHistory).toEqual([]);
			expect(state.selectedBranch).toBeNull();
			expect(state.graphRoot).toBeNull();
			expect(state.graphDepth).toBe(2);
			expect(state.running).toBe(true);
		});

		it("accepts initial view override", () => {
			const state = createInitialState(mockTenant, "browse");
			expect(state.activeView).toBe("browse");
		});
	});

	describe("cycleView", () => {
		it("cycles chat → browse → graph → health → chat", () => {
			let state = createInitialState(mockTenant);
			expect(state.activeView).toBe("chat");

			state = cycleView(state);
			expect(state.activeView).toBe("browse");

			state = cycleView(state);
			expect(state.activeView).toBe("graph");

			state = cycleView(state);
			expect(state.activeView).toBe("health");

			state = cycleView(state);
			expect(state.activeView).toBe("chat");
		});
	});

	describe("jumpToView", () => {
		it("jumps to the specified view", () => {
			const state = createInitialState(mockTenant);
			const updated = jumpToView(state, "graph");
			expect(updated.activeView).toBe("graph");
		});
	});

	describe("appendChatMessage", () => {
		it("appends messages to chat history", () => {
			let state = createInitialState(mockTenant);
			expect(state.chatHistory).toHaveLength(0);

			const msg1: ChatMessage = { role: "user", content: "hello" };
			state = appendChatMessage(state, msg1);
			expect(state.chatHistory).toHaveLength(1);
			expect(state.chatHistory[0]).toEqual(msg1);

			const msg2: ChatMessage = { role: "euclid", content: "I found 2 branches..." };
			state = appendChatMessage(state, msg2);
			expect(state.chatHistory).toHaveLength(2);
			expect(state.chatHistory[1]).toEqual(msg2);
		});

		it("does not mutate original state", () => {
			const original = createInitialState(mockTenant);
			const msg: ChatMessage = { role: "user", content: "test" };
			const updated = appendChatMessage(original, msg);
			expect(original.chatHistory).toHaveLength(0);
			expect(updated.chatHistory).toHaveLength(1);
		});
	});

	describe("setSelectedBranch", () => {
		it("updates selectedBranch", () => {
			const state = createInitialState(mockTenant);
			const updated = setSelectedBranch(state, "ideas/auth");
			expect(updated.selectedBranch).toBe("ideas/auth");
		});

		it("clears selectedBranch with null", () => {
			const state = setSelectedBranch(createInitialState(mockTenant), "ideas/auth");
			const cleared = setSelectedBranch(state, null);
			expect(cleared.selectedBranch).toBeNull();
		});
	});

	describe("setGraphRoot", () => {
		it("updates graphRoot", () => {
			const state = createInitialState(mockTenant);
			const updated = setGraphRoot(state, "domains/auth");
			expect(updated.graphRoot).toBe("domains/auth");
		});
	});

	describe("setGraphDepth", () => {
		it("clamps depth to 1-3 range", () => {
			const state = createInitialState(mockTenant);

			expect(setGraphDepth(state, 0).graphDepth).toBe(1);
			expect(setGraphDepth(state, 1).graphDepth).toBe(1);
			expect(setGraphDepth(state, 2).graphDepth).toBe(2);
			expect(setGraphDepth(state, 3).graphDepth).toBe(3);
			expect(setGraphDepth(state, 4).graphDepth).toBe(3);
			expect(setGraphDepth(state, 10).graphDepth).toBe(3);
			expect(setGraphDepth(state, -1).graphDepth).toBe(1);
		});
	});
});
