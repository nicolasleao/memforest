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

export class EuclidError extends MemforestError {
	constructor(message: string, code = "EUCLID_ERROR") {
		super(message, code);
	}
}

export class MissingApiKeyError extends EuclidError {
	constructor(provider: string, envVars: string[]) {
		const varList = envVars.join(" or ");
		super(
			`No API key found for provider "${provider}". ` +
				`Set ${varList} in ~/.memforest/.env or your environment.`,
			"MISSING_API_KEY",
		);
	}
}
