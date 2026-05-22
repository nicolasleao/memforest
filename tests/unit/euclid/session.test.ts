import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

vi.mock("@earendil-works/pi-agent-core", () => ({
	Agent: vi.fn(),
}));

vi.mock("@earendil-works/pi-ai", () => ({
	getModel: vi.fn(() => ({ provider: "anthropic", id: "claude-sonnet-4-6" })),
}));

// Mock bun:sqlite to prevent resolution errors from transitive imports
vi.mock("bun:sqlite", () => ({
	Database: vi.fn(),
}));

vi.mock("@memforest/mycelium", () => ({
	initDatabase: vi.fn(() => ({ close: vi.fn() })),
	closeDatabase: vi.fn(),
}));

// session.ts imports "./tools.js" — vitest needs the mock keyed by resolved path
// to intercept same-directory imports from the source module
vi.mock(new URL("../../../src/euclid/tools.js", import.meta.url).pathname, () => ({
	createEuclidTools: vi.fn(() => []),
}));

// --- Imports (after mocks) ---

import { Agent } from "@earendil-works/pi-agent-core";
import { getModel } from "@earendil-works/pi-ai";
import { MAINTENANCE_PROMPT, createEuclidSession } from "@memforest/euclid";
import { closeDatabase, initDatabase } from "@memforest/mycelium";
import type { TenantContext } from "@memforest/shared";

// --- Fixtures ---

const mockTenant: TenantContext = {
	name: "test-forest",
	forestPath: "/tmp/test-forest",
	treesPath: "/tmp/test-forest/trees",
	databasePath: "/tmp/test-forest/forest.db",
	configPath: "/tmp/test-forest/forest.toml",
};

function makeMockAgent() {
	return {
		prompt: vi.fn(),
		subscribe: vi.fn(() => vi.fn()),
		abort: vi.fn(),
		state: {
			messages: [] as unknown[],
		},
	};
}

function setupAgentMock(agent?: ReturnType<typeof makeMockAgent>) {
	const mock = agent ?? makeMockAgent();
	(Agent as unknown as Mock).mockImplementation(() => mock);
	return mock;
}

// --- Tests ---

describe("createEuclidSession", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("constructs an Agent instance", async () => {
		setupAgentMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(Agent).toHaveBeenCalledTimes(1);
	});

	it("passes system prompt to Agent via initialState", async () => {
		setupAgentMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		const args = (Agent as unknown as Mock).mock.calls[0][0];
		expect(typeof args.initialState.systemPrompt).toBe("string");
		expect(args.initialState.systemPrompt).toContain("test-forest");
	});

	it("passes model from getModel to Agent via initialState", async () => {
		setupAgentMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(getModel).toHaveBeenCalled();
		const args = (Agent as unknown as Mock).mock.calls[0][0];
		expect(args.initialState.model).toEqual({
			provider: "anthropic",
			id: "claude-sonnet-4-6",
		});
	});

	it("passes tools from createEuclidTools to Agent via initialState", async () => {
		setupAgentMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		const args = (Agent as unknown as Mock).mock.calls[0][0];
		expect(args.initialState.tools).toEqual([]);
	});

	it("initializes database for tenant", async () => {
		setupAgentMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(initDatabase).toHaveBeenCalledWith(mockTenant);
	});

	it("custom model with provider prefix splits into provider and id for getModel", async () => {
		setupAgentMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat", model: "openai/gpt-4o" });
		expect(getModel).toHaveBeenCalledWith("openai", "gpt-4o");
	});

	it("custom model without provider prefix defaults to anthropic provider for getModel", async () => {
		setupAgentMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat", model: "claude-sonnet-4-6" });
		expect(getModel).toHaveBeenCalledWith("anthropic", "claude-sonnet-4-6");
	});

	it("no model uses default anthropic/claude-sonnet-4 getModel call", async () => {
		setupAgentMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(getModel).toHaveBeenCalledWith("anthropic", "claude-sonnet-4-6");
	});
});

describe("EuclidSessionHandle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("prompt() calls agent.prompt and extracts text from last assistant message", async () => {
		const mock = makeMockAgent();
		mock.prompt.mockImplementation(async () => {
			mock.state.messages.push({
				role: "assistant",
				content: [{ type: "text", text: "Test response from Euclid" }],
			});
		});
		setupAgentMock(mock);

		const handle = await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		const result = await handle.prompt("hello");
		expect(mock.prompt).toHaveBeenCalledWith("hello");
		expect(result).toBe("Test response from Euclid");
	});

	it("subscribe() delegates to agent.subscribe and returns unsubscribe fn", async () => {
		const mock = makeMockAgent();
		const unsubscribe = vi.fn();
		mock.subscribe.mockReturnValue(unsubscribe);
		setupAgentMock(mock);

		const handle = await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		const listener = vi.fn();
		const unsub = handle.subscribe(listener);
		expect(mock.subscribe).toHaveBeenCalledTimes(1);
		expect(typeof unsub).toBe("function");
	});

	it("dispose() calls closeDatabase", async () => {
		setupAgentMock();
		const handle = await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		await handle.dispose();
		expect(closeDatabase).toHaveBeenCalledTimes(1);
	});
});

describe("MAINTENANCE_PROMPT", () => {
	it("is non-empty", () => {
		expect(MAINTENANCE_PROMPT.length).toBeGreaterThan(50);
	});

	it("mentions health", () => {
		expect(MAINTENANCE_PROMPT).toContain("health");
	});
});
