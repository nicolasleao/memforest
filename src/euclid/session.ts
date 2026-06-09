import * as path from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import { getModel } from "@earendil-works/pi-ai";
import type { Message } from "@earendil-works/pi-ai";
import { closeDatabase, initDatabase } from "@memforest/mycelium";
import type { Db } from "@memforest/mycelium";
import { EuclidError, MissingApiKeyError, getRootPath } from "@memforest/shared";
import dotenv from "dotenv";
import { buildFullSystemPrompt } from "./prompts.js";
import { createEuclidTools } from "./tools.js";
import type { EuclidConfig } from "./types.js";

export type EuclidEventListener = (event: unknown) => void;

export interface EuclidSessionHandle {
	prompt(message: string): Promise<string>;
	subscribe(listener: EuclidEventListener): () => void;
	dispose(): Promise<void>;
}

export const MAINTENANCE_PROMPT = `Run a complete maintenance cycle on the current forest:
1. Use forest_health to check current forest state
2. Fix any broken links you can resolve
3. Connect orphan branches to related content
4. Flag stale branches (not updated in 30+ days)
5. Reindex if needed using forest_reindex
6. Report all actions taken and recommendations

Use your autonomy boundaries — do AUTO actions directly, flag CONFIRM actions for my review.
Only respond with a structured summary of what you did and what needs my attention.`;

function parseModelString(modelStr: string): { provider: string; id: string } {
	if (modelStr.includes("/")) {
		const [provider, ...rest] = modelStr.split("/");
		return { provider, id: rest.join("/") };
	}
	return { provider: "anthropic", id: modelStr };
}

function extractTextFromMessages(messages: AgentMessage[]): string {
	const parts: string[] = [];
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role !== "assistant") continue;

		// AssistantMessage.content is always an array of content blocks.
		for (const block of msg.content) {
			if (block.type === "text") parts.push(block.text);
		}
		break;
	}
	return parts.join("\n");
}

const API_KEY_ENV: Record<string, string[]> = {
	anthropic: ["ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_API_KEY"],
	openai: ["OPENAI_API_KEY"],
	google: ["GEMINI_API_KEY"],
	deepseek: ["DEEPSEEK_API_KEY"],
	groq: ["GROQ_API_KEY"],
	xai: ["XAI_API_KEY"],
	openrouter: ["OPENROUTER_API_KEY"],
	mistral: ["MISTRAL_API_KEY"],
};

let dotEnvLoaded = false;

function loadDotEnv(): void {
	if (dotEnvLoaded) return;
	dotEnvLoaded = true;
	dotenv.config({ path: path.join(getRootPath(), ".env") });
}

function getApiKey(provider: string): string | undefined {
	loadDotEnv();
	const envVars = API_KEY_ENV[provider] ?? [`${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`];
	for (const envVar of envVars) {
		const value = process.env[envVar];
		if (value) return value;
	}
	return undefined;
}

function convertToLlm(messages: AgentMessage[]): Message[] {
	// Keep LLM messages; drop agent-only messages (e.g. compactionSummary).
	// Note: the tool-result role is "toolResult" (camelCase) in pi-ai.
	return messages.filter(
		(m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
	);
}

export async function createEuclidSession(config: EuclidConfig): Promise<EuclidSessionHandle> {
	const db: Db = initDatabase(config.tenant);
	const tools = createEuclidTools(config.tenant, db);
	const systemPrompt = buildFullSystemPrompt(config.tenant.name, config.tenant.forestPath);

	const model = config.model
		? (() => {
				const parsed = parseModelString(config.model);
				return getModel(parsed.provider as "anthropic", parsed.id as "claude-sonnet-4-6");
			})()
		: getModel("anthropic", "claude-sonnet-4-6");

	const provider = model.provider;
	const resolvedKey = getApiKey(provider);
	if (!resolvedKey) {
		closeDatabase(db);
		const envVars = API_KEY_ENV[provider] ?? [
			`${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`,
		];
		throw new MissingApiKeyError(provider, envVars);
	}

	const agent = new Agent({
		initialState: {
			systemPrompt,
			model,
			tools,
			thinkingLevel: "medium",
		},
		convertToLlm,
		getApiKey,
	});

	return {
		async prompt(message: string): Promise<string> {
			await agent.prompt(message);
			if (agent.state.errorMessage) {
				throw new EuclidError(agent.state.errorMessage);
			}
			const text = extractTextFromMessages(agent.state.messages);
			if (!text.trim()) {
				throw new EuclidError(
					"Euclid returned an empty response. This usually means the API call failed silently. " +
						"Check your API key in ~/.memforest/.env and verify your account has available credits.",
				);
			}
			return text;
		},
		subscribe(listener: EuclidEventListener): () => void {
			return agent.subscribe((event: AgentEvent) => {
				listener(event);
			});
		},
		async dispose(): Promise<void> {
			agent.abort();
			closeDatabase(db);
		},
	};
}
