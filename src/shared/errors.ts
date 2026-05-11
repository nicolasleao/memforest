export class MemforestError extends Error {
	constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
		this.name = "MemforestError";
	}
}

export class ForestNotFoundError extends MemforestError {
	constructor(name: string) {
		super(`Forest "${name}" not found`, "FOREST_NOT_FOUND");
	}
}

export class ForestAlreadyExistsError extends MemforestError {
	constructor(name: string) {
		super(`Forest "${name}" already exists`, "FOREST_ALREADY_EXISTS");
	}
}

export class NoActiveForestError extends MemforestError {
	constructor() {
		super("No active forest. Run 'memforest use <name>' first.", "NO_ACTIVE_FOREST");
	}
}

export class BranchNotFoundError extends MemforestError {
	constructor(path: string) {
		super(`Branch not found: "${path}"`, "BRANCH_NOT_FOUND");
	}
}

export class BranchAlreadyExistsError extends MemforestError {
	constructor(path: string) {
		super(`Branch already exists: "${path}"`, "BRANCH_ALREADY_EXISTS");
	}
}

export class ConfigError extends MemforestError {
	constructor(message: string) {
		super(message, "CONFIG_ERROR");
	}
}

export class DatabaseError extends MemforestError {
	constructor(message: string) {
		super(message, "DATABASE_ERROR");
	}
}
