import { describe, expect, it } from "vitest";
import {
	EUCLID_SYSTEM_PROMPT,
	SKILL_GENERATE_REPORT,
	SKILL_MAINTAIN_FOREST,
	SKILL_MERGE_DUPLICATES,
	SKILL_PLANT_IDEA,
	SKILL_RESEARCH_BREAKDOWN,
	SKILL_TOOL_REFERENCE,
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

	it("references tools instead of CLI", () => {
		expect(EUCLID_SYSTEM_PROMPT).toContain("direct tools");
		expect(EUCLID_SYSTEM_PROMPT).not.toContain("bash access");
		expect(EUCLID_SYSTEM_PROMPT).not.toContain("memforest CLI");
	});
});

describe("Skill constants", () => {
	it("each skill is non-empty", () => {
		const skills = [
			SKILL_TOOL_REFERENCE,
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

	it("tool reference documents all tools", () => {
		const tools = [
			"forest_search",
			"forest_upsert",
			"forest_read",
			"forest_list",
			"forest_health",
			"forest_reindex",
			"forest_delete",
		];
		for (const tool of tools) {
			expect(SKILL_TOOL_REFERENCE).toContain(tool);
		}
	});

	it("plant idea skill has workflow steps", () => {
		expect(SKILL_PLANT_IDEA).toContain("Decompose");
		expect(SKILL_PLANT_IDEA).toContain("Plant branches");
		expect(SKILL_PLANT_IDEA).toContain("Verify");
	});

	it("research skill references forest_search", () => {
		expect(SKILL_RESEARCH_BREAKDOWN).toContain("forest_search");
	});

	it("maintain skill references forest_health", () => {
		expect(SKILL_MAINTAIN_FOREST).toContain("forest_health");
	});

	it("merge skill emphasizes confirmation", () => {
		expect(SKILL_MERGE_DUPLICATES).toContain("CONFIRM");
	});

	it("report skill has provenance section", () => {
		const hasProvenance =
			SKILL_GENERATE_REPORT.includes("provenance") || SKILL_GENERATE_REPORT.includes("wiki-links");
		expect(hasProvenance).toBe(true);
	});

	it("no skill references memforest CLI commands", () => {
		const skills = [
			SKILL_TOOL_REFERENCE,
			SKILL_PLANT_IDEA,
			SKILL_RESEARCH_BREAKDOWN,
			SKILL_GENERATE_REPORT,
			SKILL_MAINTAIN_FOREST,
			SKILL_MERGE_DUPLICATES,
		];
		for (const skill of skills) {
			expect(skill).not.toContain("memforest upsert");
			expect(skill).not.toContain("memforest search");
			expect(skill).not.toContain("memforest health --json");
			expect(skill).not.toContain("memforest reindex");
		}
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
		expect(result).toContain("Skill: Forest Tool Reference");
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
