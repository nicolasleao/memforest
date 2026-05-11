import { parseMarkdownFile, serializeMarkdownFile } from "@memforest/forest";
import { describe, expect, it } from "vitest";

describe("parseMarkdownFile", () => {
	it("splits frontmatter from content correctly", () => {
		const raw = `---
title: My Note
tags:
  - test
status: growing
---
Hello world`;
		const { frontmatter, content } = parseMarkdownFile(raw);
		expect(frontmatter.title).toBe("My Note");
		expect(frontmatter.tags).toEqual(["test"]);
		expect(frontmatter.status).toBe("growing");
		expect(content.trim()).toBe("Hello world");
	});

	it("applies defaults for missing fields", () => {
		const raw = `---
title: Only Title
---
Content here`;
		const { frontmatter } = parseMarkdownFile(raw);
		expect(frontmatter.title).toBe("Only Title");
		expect(frontmatter.tags).toEqual([]);
		expect(frontmatter.aliases).toEqual([]);
		expect(frontmatter.status).toBe("seed");
		expect(frontmatter.created).toBeDefined();
		expect(frontmatter.updated).toBeDefined();
	});

	it("preserves unknown fields", () => {
		const raw = `---
title: Note
custom_field: custom_value
nested:
  key: value
---
Content`;
		const { frontmatter } = parseMarkdownFile(raw);
		expect(frontmatter.title).toBe("Note");
		expect(frontmatter.custom_field).toBe("custom_value");
		expect(frontmatter.nested).toEqual({ key: "value" });
	});

	it("handles content without frontmatter", () => {
		const raw = "Just content, no frontmatter.";
		const { frontmatter, content } = parseMarkdownFile(raw);
		expect(frontmatter.title).toBe("");
		expect(frontmatter.status).toBe("seed");
		expect(content.trim()).toBe("Just content, no frontmatter.");
	});
});

describe("serializeMarkdownFile", () => {
	it("roundtrips with parseMarkdownFile", () => {
		const raw = `---
title: Roundtrip Test
tags:
  - a
  - b
aliases: []
status: mature
created: "2026-01-01T00:00:00.000Z"
updated: "2026-01-02T00:00:00.000Z"
---
Some content here.`;

		const { frontmatter, content } = parseMarkdownFile(raw);
		const serialized = serializeMarkdownFile(frontmatter, content);
		const reparsed = parseMarkdownFile(serialized);

		expect(reparsed.frontmatter.title).toBe("Roundtrip Test");
		expect(reparsed.frontmatter.tags).toEqual(["a", "b"]);
		expect(reparsed.frontmatter.status).toBe("mature");
		expect(reparsed.content.trim()).toBe("Some content here.");
	});
});
