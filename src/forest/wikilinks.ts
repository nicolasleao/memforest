const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export function extractWikiLinks(content: string): string[] {
	const links: Set<string> = new Set();

	for (const match of content.matchAll(WIKILINK_REGEX)) {
		const target = match[1].trim();
		if (target.length > 0) {
			links.add(target);
		}
	}

	return Array.from(links);
}
