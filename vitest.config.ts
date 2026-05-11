import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["tests/**/*.test.ts"],
		testTimeout: 30000,
	},
	resolve: {
		alias: {
			"@memforest/shared": new URL("src/shared/index.ts", import.meta.url).pathname,
			"@memforest/forest": new URL("src/forest/index.ts", import.meta.url).pathname,
			"@memforest/mycelium": new URL("src/mycelium/index.ts", import.meta.url).pathname,
			"@memforest/euclid": new URL("src/euclid/index.ts", import.meta.url).pathname,
		},
	},
});
