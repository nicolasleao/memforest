import { createAgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import { buildFullSystemPrompt } from "./prompts.js";
import type { EuclidConfig } from "./types.js";

export interface EuclidSessionHandle {
	prompt(message: string): Promise<string>;
	dispose(): Promise<void>;
}

export const MAINTENANCE_PROMPT = `Run a complete maintenance cycle on the current forest:
1. Check forest health with \`memforest health --json\`
2. Fix any broken links you can resolve
3. Connect orphan branches to related content
4. Flag stale branches (not updated in 30+ days)
5. Reindex if needed
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

function extractTextFromMessages(messages: unknown[]): string {
	const parts: string[] = [];
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i] as Record<string, unknown>;
		if (msg.role !== "assistant") continue;

		const content = msg.content;
		if (typeof content === "string") {
			parts.push(content);
		} else if (Array.isArray(content)) {
			for (const block of content) {
				if (
					typeof block === "object" &&
					block !== null &&
					(block as Record<string, unknown>).type === "text" &&
					typeof (block as Record<string, unknown>).text === "string"
				) {
					parts.push((block as Record<string, unknown>).text as string);
				}
			}
		}
		break;
	}
	return parts.join("\n");
}

export async function createEuclidSession(config: EuclidConfig): Promise<EuclidSessionHandle> {
	const systemPrompt = buildFullSystemPrompt(config.tenant.name, config.tenant.forestPath);

	const { session } = await createAgentSession({
		cwd: config.tenant.forestPath,
		systemPrompt: [systemPrompt],
		modelPattern: config.model
			? (() => {
					const parsed = parseModelString(config.model);
					return `${parsed.provider}/${parsed.id}`;
				})()
			: undefined,
		hasUI: config.mode === "chat",
		enableMCP: false,
		enableLsp: false,
		skipPythonPreflight: true,
	});

	return {
		async prompt(message: string): Promise<string> {
			const beforeCount = session.messages.length;
			await session.prompt(message);
			const afterMessages = session.messages.slice(beforeCount);
			return extractTextFromMessages(afterMessages);
		},
		async dispose(): Promise<void> {
			await session.dispose();
		},
	};
}
