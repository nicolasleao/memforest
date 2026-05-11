import * as fs from "node:fs";
import * as path from "node:path";
import {
	type Branch,
	BranchAlreadyExistsError,
	type BranchFrontmatter,
	BranchNotFoundError,
	MemforestError,
	type TenantContext,
} from "@memforest/shared";
import { parseMarkdownFile, serializeMarkdownFile } from "./frontmatter.js";
import { extractWikiLinks } from "./wikilinks.js";

const NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function validateName(value: string, label: string): void {
	if (!NAME_REGEX.test(value)) {
		throw new MemforestError(
			`Invalid ${label} "${value}". Must start with alphanumeric, contain only alphanumeric, dots, hyphens, underscores.`,
			"INVALID_NAME",
		);
	}
}

function branchFilePath(tenant: TenantContext, treeName: string, branchName: string): string {
	return path.join(tenant.treesPath, treeName, `${branchName}.md`);
}

function buildBranch(
	treeName: string,
	branchName: string,
	frontmatter: BranchFrontmatter,
	content: string,
): Branch {
	return {
		treeName,
		branchName,
		relativePath: `${treeName}/${branchName}`,
		frontmatter,
		content,
		wikiLinks: extractWikiLinks(content),
	};
}

export function createBranch(
	tenant: TenantContext,
	treeName: string,
	branchName: string,
	content: string,
	frontmatter?: Partial<BranchFrontmatter>,
): Branch {
	validateName(treeName, "tree name");
	validateName(branchName, "branch name");

	const filePath = branchFilePath(tenant, treeName, branchName);

	if (fs.existsSync(filePath)) {
		throw new BranchAlreadyExistsError(`${treeName}/${branchName}`);
	}

	const now = new Date().toISOString();
	const merged: BranchFrontmatter = {
		title: branchName,
		created: now,
		updated: now,
		tags: [],
		aliases: [],
		status: "seed",
		...frontmatter,
	};

	const treeDir = path.dirname(filePath);
	fs.mkdirSync(treeDir, { recursive: true });

	const raw = serializeMarkdownFile(merged, content);
	fs.writeFileSync(filePath, raw, "utf-8");

	return buildBranch(treeName, branchName, merged, content);
}

export function readBranch(tenant: TenantContext, treeName: string, branchName: string): Branch {
	const filePath = branchFilePath(tenant, treeName, branchName);

	if (!fs.existsSync(filePath)) {
		throw new BranchNotFoundError(`${treeName}/${branchName}`);
	}

	const raw = fs.readFileSync(filePath, "utf-8");
	const { frontmatter, content } = parseMarkdownFile(raw);

	return buildBranch(treeName, branchName, frontmatter, content);
}

export function updateBranch(
	tenant: TenantContext,
	treeName: string,
	branchName: string,
	content: string,
	frontmatter?: Partial<BranchFrontmatter>,
): Branch {
	const existing = readBranch(tenant, treeName, branchName);

	const now = new Date().toISOString();
	const merged: BranchFrontmatter = {
		...existing.frontmatter,
		...frontmatter,
		updated: now,
	};

	const filePath = branchFilePath(tenant, treeName, branchName);
	const raw = serializeMarkdownFile(merged, content);
	fs.writeFileSync(filePath, raw, "utf-8");

	return buildBranch(treeName, branchName, merged, content);
}

export function deleteBranch(tenant: TenantContext, treeName: string, branchName: string): void {
	const filePath = branchFilePath(tenant, treeName, branchName);

	if (!fs.existsSync(filePath)) {
		throw new BranchNotFoundError(`${treeName}/${branchName}`);
	}

	fs.unlinkSync(filePath);

	const treeDir = path.dirname(filePath);
	const remaining = fs.readdirSync(treeDir);
	if (remaining.length === 0) {
		fs.rmdirSync(treeDir);
	}
}

export function listBranches(tenant: TenantContext, treeName?: string): Branch[] {
	const branches: Branch[] = [];

	if (!fs.existsSync(tenant.treesPath)) {
		return branches;
	}

	const treeNames = treeName
		? [treeName]
		: fs
				.readdirSync(tenant.treesPath, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);

	for (const tree of treeNames) {
		const treeDir = path.join(tenant.treesPath, tree);
		if (!fs.existsSync(treeDir)) {
			continue;
		}

		const files = fs.readdirSync(treeDir).filter((file) => file.endsWith(".md"));

		for (const file of files) {
			const name = file.slice(0, -3);
			const filePath = path.join(treeDir, file);
			const raw = fs.readFileSync(filePath, "utf-8");
			const { frontmatter, content } = parseMarkdownFile(raw);
			branches.push(buildBranch(tree, name, frontmatter, content));
		}
	}

	branches.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
	return branches;
}

export function branchExists(tenant: TenantContext, treeName: string, branchName: string): boolean {
	return fs.existsSync(branchFilePath(tenant, treeName, branchName));
}

export function resolveBranchByLink(tenant: TenantContext, linkTarget: string): Branch | null {
	if (linkTarget.includes("/")) {
		const [treeName, branchName] = linkTarget.split("/", 2);
		if (branchExists(tenant, treeName, branchName)) {
			return readBranch(tenant, treeName, branchName);
		}
		return null;
	}

	const allBranches = listBranches(tenant);

	for (const branch of allBranches) {
		if (branch.branchName === linkTarget) {
			return branch;
		}
	}

	for (const branch of allBranches) {
		if (branch.frontmatter.aliases.includes(linkTarget)) {
			return branch;
		}
	}

	return null;
}
