import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { SearchResult } from "@memforest/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/index.js";

let tempDir: string;
const originalHome = process.env.MEMFOREST_HOME;
const originalForest = process.env.MEMFOREST_FOREST;

beforeEach(() => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-flag-"));
	process.env.MEMFOREST_HOME = tempDir;
	// biome-ignore lint/performance/noDelete: process.env requires delete to unset
	delete process.env.MEMFOREST_FOREST;
});

afterEach(() => {
	fs.rmSync(tempDir, { recursive: true, force: true });
	if (originalHome === undefined) {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_HOME;
	} else {
		process.env.MEMFOREST_HOME = originalHome;
	}
	if (originalForest === undefined) {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_FOREST;
	} else {
		process.env.MEMFOREST_FOREST = originalForest;
	}
});

/** Drive the real CLI in-process, one fresh program per invocation (the per-invocation contract). */
async function run(argv: string[]): Promise<void> {
	await createProgram().parseAsync(argv, { from: "user" });
}

/** Run a `search ... --json` invocation and parse the JSON it writes to stdout. */
async function searchJson(argv: string[]): Promise<SearchResult[]> {
	const chunks: string[] = [];
	const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
		chunks.push(String(chunk));
		return true;
	});
	try {
		await run(argv);
	} finally {
		spy.mockRestore();
	}
	return JSON.parse(chunks.join("")) as SearchResult[];
}

/** Two forests with one distinct note each, written via `--forest` overrides. */
async function seedTwoForests(): Promise<void> {
	await run(["init", "a"]);
	await run(["init", "b"]);
	await run(["upsert", "facts/a", "alpha content", "--forest", "a"]);
	await run(["upsert", "facts/b", "beta content", "--forest", "b"]);
}

describe("per-invocation --forest flag (interleave-race regression)", () => {
	it("--forest pins the invocation even after an interleaved `use` of another forest", async () => {
		await seedTwoForests();

		// The race under test: a stateful `use b` lands between the writer and the reader.
		await run(["use", "b"]);

		const hitsA = await searchJson(["search", "content", "--json", "--forest", "a"]);
		expect(hitsA).toHaveLength(1);
		expect(hitsA[0].branch.content).toContain("alpha content");
		for (const hit of hitsA) {
			expect(hit.branch.content).not.toContain("beta content");
		}

		// No flag → sticky active-forest behavior is intact.
		const hitsSticky = await searchJson(["search", "content", "--json"]);
		expect(hitsSticky).toHaveLength(1);
		expect(hitsSticky[0].branch.content).toContain("beta content");
		for (const hit of hitsSticky) {
			expect(hit.branch.content).not.toContain("alpha content");
		}
	});

	it("MEMFOREST_FOREST env pins the invocation when no flag is given", async () => {
		await seedTwoForests();
		await run(["use", "b"]);

		process.env.MEMFOREST_FOREST = "a";
		const hits = await searchJson(["search", "content", "--json"]);
		expect(hits).toHaveLength(1);
		expect(hits[0].branch.content).toContain("alpha content");
	});
});
