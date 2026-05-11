import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	branchExists,
	createBranch,
	createForest,
	deleteBranch,
	listBranches,
	readBranch,
	resolveBranchByLink,
	updateBranch,
} from "@memforest/forest";
import {
	BranchAlreadyExistsError,
	BranchNotFoundError,
	MemforestError,
	type TenantContext,
} from "@memforest/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let tenant: TenantContext;
const originalEnv = process.env.MEMFOREST_HOME;

beforeEach(() => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memforest-test-"));
	process.env.MEMFOREST_HOME = tempDir;
	tenant = createForest("testforest", tempDir);
});

afterEach(() => {
	fs.rmSync(tempDir, { recursive: true, force: true });
	if (originalEnv === undefined) {
		// biome-ignore lint/performance/noDelete: process.env requires delete to unset
		delete process.env.MEMFOREST_HOME;
	} else {
		process.env.MEMFOREST_HOME = originalEnv;
	}
});

describe("createBranch", () => {
	it("writes correct file with frontmatter", () => {
		const branch = createBranch(tenant, "ideas", "my-note", "Hello world");
		expect(branch.treeName).toBe("ideas");
		expect(branch.branchName).toBe("my-note");
		expect(branch.relativePath).toBe("ideas/my-note");
		expect(branch.content).toBe("Hello world");
		expect(branch.frontmatter.title).toBe("my-note");
		expect(branch.frontmatter.status).toBe("seed");

		const filePath = path.join(tenant.treesPath, "ideas", "my-note.md");
		expect(fs.existsSync(filePath)).toBe(true);
	});

	it("applies partial frontmatter with defaults", () => {
		const branch = createBranch(tenant, "ideas", "noted", "Content", {
			title: "Custom Title",
			tags: ["important"],
			status: "growing",
		});
		expect(branch.frontmatter.title).toBe("Custom Title");
		expect(branch.frontmatter.tags).toEqual(["important"]);
		expect(branch.frontmatter.status).toBe("growing");
		expect(branch.frontmatter.aliases).toEqual([]);
	});

	it("throws on duplicate", () => {
		createBranch(tenant, "ideas", "dup", "First");
		expect(() => createBranch(tenant, "ideas", "dup", "Second")).toThrow(BranchAlreadyExistsError);
	});

	it("creates tree directory if missing", () => {
		const treeDir = path.join(tenant.treesPath, "new-tree");
		expect(fs.existsSync(treeDir)).toBe(false);
		createBranch(tenant, "new-tree", "first", "Content");
		expect(fs.existsSync(treeDir)).toBe(true);
	});

	it("extracts wiki-links from content", () => {
		const branch = createBranch(
			tenant,
			"ideas",
			"linker",
			"See [[auth]] and [[sessions|Session Notes]].",
		);
		expect(branch.wikiLinks).toEqual(["auth", "sessions"]);
	});

	it("throws on invalid tree name", () => {
		expect(() => createBranch(tenant, "../bad", "note", "x")).toThrow(MemforestError);
	});

	it("throws on invalid branch name", () => {
		expect(() => createBranch(tenant, "ideas", "../bad", "x")).toThrow(MemforestError);
	});
});

describe("readBranch", () => {
	it("returns correct Branch with parsed frontmatter and wiki-links", () => {
		createBranch(tenant, "domains", "auth", "Use [[jwt]] for tokens.");
		const branch = readBranch(tenant, "domains", "auth");
		expect(branch.treeName).toBe("domains");
		expect(branch.branchName).toBe("auth");
		expect(branch.frontmatter.title).toBe("auth");
		expect(branch.wikiLinks).toEqual(["jwt"]);
	});

	it("throws BranchNotFoundError for missing branch", () => {
		expect(() => readBranch(tenant, "ideas", "ghost")).toThrow(BranchNotFoundError);
	});
});

describe("updateBranch", () => {
	it("merges frontmatter and updates timestamp", () => {
		createBranch(tenant, "ideas", "evolve", "V1", {
			tags: ["draft"],
			created: "2020-01-01T00:00:00.000Z",
			updated: "2020-01-01T00:00:00.000Z",
		});
		const updated = updateBranch(tenant, "ideas", "evolve", "V2", {
			tags: ["final"],
			status: "mature",
		});
		expect(updated.content).toBe("V2");
		expect(updated.frontmatter.tags).toEqual(["final"]);
		expect(updated.frontmatter.status).toBe("mature");
		expect(updated.frontmatter.updated).not.toBe("2020-01-01T00:00:00.000Z");
	});

	it("throws for missing branch", () => {
		expect(() => updateBranch(tenant, "ideas", "ghost", "x")).toThrow(BranchNotFoundError);
	});
});

describe("deleteBranch", () => {
	it("removes file", () => {
		createBranch(tenant, "ideas", "ephemeral", "Gone soon");
		deleteBranch(tenant, "ideas", "ephemeral");
		expect(branchExists(tenant, "ideas", "ephemeral")).toBe(false);
	});

	it("removes empty tree directory", () => {
		createBranch(tenant, "lonely", "only", "Single note");
		deleteBranch(tenant, "lonely", "only");
		expect(fs.existsSync(path.join(tenant.treesPath, "lonely"))).toBe(false);
	});

	it("throws for missing branch", () => {
		expect(() => deleteBranch(tenant, "ideas", "ghost")).toThrow(BranchNotFoundError);
	});
});

describe("listBranches", () => {
	it("returns all branches across all trees", () => {
		createBranch(tenant, "ideas", "alpha", "A");
		createBranch(tenant, "domains", "beta", "B");
		createBranch(tenant, "ideas", "gamma", "C");
		const branches = listBranches(tenant);
		expect(branches).toHaveLength(3);
		expect(branches.map((b) => b.relativePath)).toEqual([
			"domains/beta",
			"ideas/alpha",
			"ideas/gamma",
		]);
	});

	it("filters by tree name", () => {
		createBranch(tenant, "ideas", "one", "1");
		createBranch(tenant, "domains", "two", "2");
		const branches = listBranches(tenant, "ideas");
		expect(branches).toHaveLength(1);
		expect(branches[0].branchName).toBe("one");
	});

	it("returns empty array for empty forest", () => {
		expect(listBranches(tenant)).toEqual([]);
	});
});

describe("branchExists", () => {
	it("returns true when branch exists", () => {
		createBranch(tenant, "ideas", "here", "Present");
		expect(branchExists(tenant, "ideas", "here")).toBe(true);
	});

	it("returns false when branch does not exist", () => {
		expect(branchExists(tenant, "ideas", "nope")).toBe(false);
	});
});

describe("resolveBranchByLink", () => {
	it("resolves qualified link (tree/branch)", () => {
		createBranch(tenant, "domains", "auth", "Auth content");
		const result = resolveBranchByLink(tenant, "domains/auth");
		expect(result).not.toBeNull();
		expect(result?.branchName).toBe("auth");
	});

	it("resolves unqualified link by branch name", () => {
		createBranch(tenant, "domains", "auth", "Auth content");
		const result = resolveBranchByLink(tenant, "auth");
		expect(result).not.toBeNull();
		expect(result?.branchName).toBe("auth");
	});

	it("resolves by alias", () => {
		createBranch(tenant, "domains", "authentication", "Auth", {
			aliases: ["auth"],
		});
		const result = resolveBranchByLink(tenant, "auth");
		expect(result).not.toBeNull();
		expect(result?.branchName).toBe("authentication");
	});

	it("returns null for nonexistent link", () => {
		expect(resolveBranchByLink(tenant, "nonexistent")).toBeNull();
	});
});
