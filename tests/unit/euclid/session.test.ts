import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@oh-my-pi/pi-coding-agent/sdk", () => ({
	createAgentSession: vi.fn(),
}));

import { MAINTENANCE_PROMPT, createEuclidSession } from "@memforest/euclid";
import type { TenantContext } from "@memforest/shared";
import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";

const mockTenant: TenantContext = {
	name: "test-forest",
	forestPath: "/tmp/test-forest",
	treesPath: "/tmp/test-forest/trees",
	databasePath: "/tmp/test-forest/forest.db",
	configPath: "/tmp/test-forest/forest.toml",
};

function makeMockSession() {
	const messages: unknown[] = [];
	return {
		session: {
			prompt: vi.fn(),
			dispose: vi.fn(),
			messages,
		},
	};
}

function setupMock(mock?: ReturnType<typeof makeMockSession>) {
	const result = mock ?? makeMockSession();
	(createAgentSession as Mock).mockResolvedValue(result);
	return result;
}

function lastCallArgs(): Record<string, unknown> {
	return (createAgentSession as Mock).mock.calls[0][0];
}

describe("createEuclidSession", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls createAgentSession once", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(createAgentSession).toHaveBeenCalledTimes(1);
	});

	it("passes tenant forestPath as cwd", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(lastCallArgs().cwd).toBe("/tmp/test-forest");
	});

	it("passes system prompt as array", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		const sp = lastCallArgs().systemPrompt;
		expect(Array.isArray(sp)).toBe(true);
		expect((sp as string[]).length).toBe(1);
		expect(typeof (sp as string[])[0]).toBe("string");
	});

	it("system prompt contains tenant name", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		const sp = lastCallArgs().systemPrompt as string[];
		expect(sp[0]).toContain("test-forest");
	});

	it("disables MCP", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(lastCallArgs().enableMCP).toBe(false);
	});

	it("disables LSP", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(lastCallArgs().enableLsp).toBe(false);
	});

	it("skips Python preflight", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(lastCallArgs().skipPythonPreflight).toBe(true);
	});

	it("chat mode sets hasUI true", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(lastCallArgs().hasUI).toBe(true);
	});

	it("maintain mode sets hasUI false", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "maintain" });
		expect(lastCallArgs().hasUI).toBe(false);
	});

	it("model passed as modelPattern with anthropic prefix", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat", model: "claude-sonnet-4-6" });
		expect(lastCallArgs().modelPattern).toBe("anthropic/claude-sonnet-4-6");
	});

	it("model with provider prefix preserved", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat", model: "openai/gpt-4o" });
		expect(lastCallArgs().modelPattern).toBe("openai/gpt-4o");
	});

	it("no model defaults to undefined modelPattern", async () => {
		setupMock();
		await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		expect(lastCallArgs().modelPattern).toBeUndefined();
	});
});

describe("EuclidSessionHandle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("prompt() extracts text from assistant messages", async () => {
		const mock = makeMockSession();
		mock.session.prompt.mockImplementation(async () => {
			mock.session.messages.push({
				role: "assistant",
				content: [{ type: "text", text: "Test response from Euclid" }],
			});
		});
		setupMock(mock);

		const handle = await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		const result = await handle.prompt("hello");
		expect(result).toBe("Test response from Euclid");
	});

	it("dispose() calls session.dispose", async () => {
		const mock = makeMockSession();
		setupMock(mock);

		const handle = await createEuclidSession({ tenant: mockTenant, mode: "chat" });
		await handle.dispose();
		expect(mock.session.dispose).toHaveBeenCalledTimes(1);
	});
});

describe("MAINTENANCE_PROMPT", () => {
	it("is non-empty", () => {
		expect(MAINTENANCE_PROMPT.length).toBeGreaterThan(50);
	});

	it("mentions health check", () => {
		expect(MAINTENANCE_PROMPT).toContain("health");
	});
});
