import { extractWikiLinks } from "@memforest/forest";
import { describe, expect, it } from "vitest";

describe("extractWikiLinks", () => {
	it("extracts a simple wiki-link", () => {
		expect(extractWikiLinks("See [[simple]].")).toEqual(["simple"]);
	});

	it("extracts a wiki-link with tree path", () => {
		expect(extractWikiLinks("See [[tree/branch]].")).toEqual(["tree/branch"]);
	});

	it("extracts target from aliased wiki-link", () => {
		expect(extractWikiLinks("See [[target|alias]].")).toEqual(["target"]);
	});

	it("extracts multiple links and deduplicates", () => {
		const content = "See [[auth]] and [[sessions]] and [[auth]] again.";
		expect(extractWikiLinks(content)).toEqual(["auth", "sessions"]);
	});

	it("returns empty array when no links found", () => {
		expect(extractWikiLinks("No links here.")).toEqual([]);
	});

	it("handles nested/malformed brackets gracefully", () => {
		expect(extractWikiLinks("[not a link]")).toEqual([]);
		expect(extractWikiLinks("[[]]")).toEqual([]);
		expect(extractWikiLinks("[[ ]]")).toEqual([]);
		expect(extractWikiLinks("[ [broken] ]")).toEqual([]);
	});

	it("extracts from mixed content", () => {
		const content = `
# Title
Some text with [[auth-patterns]] and more.
- List item with [[domains/sessions|Sessions]]
- Another [[auth-patterns]] duplicate
`;
		expect(extractWikiLinks(content)).toEqual(["auth-patterns", "domains/sessions"]);
	});
});
