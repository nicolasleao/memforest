import { describe, expect, it } from "vitest";
import {
	EUCLID_SYSTEM_PROMPT,
	SKILL_FOREST_CLI,
	SKILL_GENERATE_REPORT,
	SKILL_MAINTAIN_FOREST,
	SKILL_MERGE_DUPLICATES,
	SKILL_PLANT_IDEA,
	SKILL_RESEARCH_BREAKDOWN,
	buildFullSystemPrompt,
} from "../../../src/euclid/prompts.js";

describe("EUCLID_SYSTEM_PROMPT", () => {
	it("contains identity", () => {
		expect(EUCLID_SYSTEM_PROMPT).toContain("Euclid");
		expect(EUCLID_SYSTEM_PROMPT).toContain("gardener");
	});

	it("contains autonomy boundaries", () => {
		expect(EUCLID_SYSTEM_PROMPT).toContain("AUTO");
		expect(EUCLID_SYSTEM_PROMPT).toContain("CONFIRM");
	});

	it("has tenant placeholders", () => {
		expect(EUCLID_SYSTEM_PROMPT).toContain("{{TENANT_NAME}}");
		expect(EUCLID_SYSTEM_PROMPT).toContain("{{FOREST_PATH}}");
	});
});

describe("Skill constants", () => {
	it("each skill is non-empty", () => {
		const skills = [
			SKILL_FOREST_CLI,
			SKILL_PLANT_IDEA,
			SKILL_RESEARCH_BREAKDOWN,
			SKILL_GENERATE_REPORT,
			SKILL_MAINTAIN_FOREST,
			SKILL_MERGE_DUPLICATES,
		];
		for (const skill of skills) {
			expect(skill.length).toBeGreaterThan(100);
		}
	});

	it("CLI skill references all commands", () => {
		const commands = ["init", "list", "use", "upsert", "search", "ask", "health", "reindex"];
		for (const cmd of commands) {
			expect(SKILL_FOREST_CLI).toContain(cmd);
		}
	});

	it("plant idea skill has workflow steps", () => {
		expect(SKILL_PLANT_IDEA).toContain("Decompose");
		expect(SKILL_PLANT_IDEA).toContain("Plant branches");
		expect(SKILL_PLANT_IDEA).toContain("Verify");
	});

	it("research skill has search commands", () => {
		expect(SKILL_RESEARCH_BREAKDOWN).toContain("memforest search");
		expect(SKILL_RESEARCH_BREAKDOWN).toContain("memforest ask");
	});

	it("maintain skill has health check", () => {
		expect(SKILL_MAINTAIN_FOREST).toContain("memforest health --json");
	});

	it("merge skill emphasizes confirmation", () => {
		expect(SKILL_MERGE_DUPLICATES).toContain("CONFIRM");
	});

	it("report skill has provenance section", () => {
		const hasProvenance =
			SKILL_GENERATE_REPORT.includes("provenance") || SKILL_GENERATE_REPORT.includes("wiki-links");
		expect(hasProvenance).toBe(true);
	});
});

describe("buildFullSystemPrompt", () => {
	it("replaces placeholders", () => {
		const result = buildFullSystemPrompt("test-forest", "/tmp/test");
		expect(result).not.toContain("{{TENANT_NAME}}");
		expect(result).not.toContain("{{FOREST_PATH}}");
		expect(result).toContain("test-forest");
		expect(result).toContain("/tmp/test");
	});

	it("includes all skills", () => {
		const result = buildFullSystemPrompt("f", "/p");
		expect(result).toContain("Skill: memforest CLI Reference");
		expect(result).toContain("Skill: Plant Idea");
		expect(result).toContain("Skill: Research Breakdown");
		expect(result).toContain("Skill: Generate Report");
		expect(result).toContain("Skill: Maintain Forest");
		expect(result).toContain("Skill: Merge Duplicates");
	});

	it("uses separators between sections", () => {
		const result = buildFullSystemPrompt("f", "/p");
		expect(result).toContain("---");
	});
});
