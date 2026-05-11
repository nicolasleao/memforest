import type { BranchFrontmatter } from "@memforest/shared";
import matter from "gray-matter";

export function parseMarkdownFile(raw: string): {
	frontmatter: BranchFrontmatter;
	content: string;
} {
	const parsed = matter(raw);
	const data = parsed.data as Record<string, unknown>;

	const now = new Date().toISOString();

	const frontmatter: BranchFrontmatter = {
		...data,
		title: typeof data.title === "string" ? data.title : "",
		created: typeof data.created === "string" ? data.created : now,
		updated: typeof data.updated === "string" ? data.updated : now,
		tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
		aliases: Array.isArray(data.aliases) ? (data.aliases as string[]) : [],
		status: isValidStatus(data.status) ? data.status : "seed",
	};

	return { frontmatter, content: parsed.content };
}

export function serializeMarkdownFile(frontmatter: BranchFrontmatter, content: string): string {
	return matter.stringify(content, frontmatter);
}

function isValidStatus(
	value: unknown,
): value is "seed" | "growing" | "mature" | "stale" | "archived" {
	return (
		typeof value === "string" && ["seed", "growing", "mature", "stale", "archived"].includes(value)
	);
}
