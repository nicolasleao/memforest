import {
	BranchAlreadyExistsError,
	BranchNotFoundError,
	ConfigError,
	DatabaseError,
	ForestAlreadyExistsError,
	ForestNotFoundError,
	MemforestError,
	NoActiveForestError,
} from "@memforest/shared";
import { describe, expect, it } from "vitest";

describe("MemforestError", () => {
	it("has correct code, message, and name", () => {
		const error = new MemforestError("test message", "TEST_CODE");
		expect(error.message).toBe("test message");
		expect(error.code).toBe("TEST_CODE");
		expect(error.name).toBe("MemforestError");
		expect(error).toBeInstanceOf(Error);
	});
});

describe("ForestNotFoundError", () => {
	it("has correct properties and is a MemforestError", () => {
		const error = new ForestNotFoundError("myforest");
		expect(error.message).toBe('Forest "myforest" not found');
		expect(error.code).toBe("FOREST_NOT_FOUND");
		expect(error).toBeInstanceOf(MemforestError);
		expect(error).toBeInstanceOf(Error);
	});
});

describe("ForestAlreadyExistsError", () => {
	it("has correct properties and is a MemforestError", () => {
		const error = new ForestAlreadyExistsError("myforest");
		expect(error.message).toBe('Forest "myforest" already exists');
		expect(error.code).toBe("FOREST_ALREADY_EXISTS");
		expect(error).toBeInstanceOf(MemforestError);
		expect(error).toBeInstanceOf(Error);
	});
});

describe("NoActiveForestError", () => {
	it("has correct properties and is a MemforestError", () => {
		const error = new NoActiveForestError();
		expect(error.message).toBe("No active forest. Run 'memforest use <name>' first.");
		expect(error.code).toBe("NO_ACTIVE_FOREST");
		expect(error).toBeInstanceOf(MemforestError);
		expect(error).toBeInstanceOf(Error);
	});
});

describe("BranchNotFoundError", () => {
	it("has correct properties and is a MemforestError", () => {
		const error = new BranchNotFoundError("domains/auth");
		expect(error.message).toBe('Branch not found: "domains/auth"');
		expect(error.code).toBe("BRANCH_NOT_FOUND");
		expect(error).toBeInstanceOf(MemforestError);
		expect(error).toBeInstanceOf(Error);
	});
});

describe("BranchAlreadyExistsError", () => {
	it("has correct properties and is a MemforestError", () => {
		const error = new BranchAlreadyExistsError("domains/auth");
		expect(error.message).toBe('Branch already exists: "domains/auth"');
		expect(error.code).toBe("BRANCH_ALREADY_EXISTS");
		expect(error).toBeInstanceOf(MemforestError);
		expect(error).toBeInstanceOf(Error);
	});
});

describe("ConfigError", () => {
	it("has correct properties and is a MemforestError", () => {
		const error = new ConfigError("bad config");
		expect(error.message).toBe("bad config");
		expect(error.code).toBe("CONFIG_ERROR");
		expect(error).toBeInstanceOf(MemforestError);
		expect(error).toBeInstanceOf(Error);
	});
});

describe("DatabaseError", () => {
	it("has correct properties and is a MemforestError", () => {
		const error = new DatabaseError("db failed");
		expect(error.message).toBe("db failed");
		expect(error.code).toBe("DATABASE_ERROR");
		expect(error).toBeInstanceOf(MemforestError);
		expect(error).toBeInstanceOf(Error);
	});
});
