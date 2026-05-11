import { Database } from "bun:sqlite";
import type { TenantContext } from "@memforest/shared";
import { ALL_SCHEMA } from "./schema.js";

export function openDatabase(tenant: TenantContext): Database {
	const database = new Database(tenant.databasePath);
	database.exec("PRAGMA journal_mode = WAL");
	return database;
}

export function initDatabase(tenant: TenantContext): Database {
	const database = openDatabase(tenant);

	database.transaction(() => {
		for (const sql of ALL_SCHEMA) {
			database.exec(sql);
		}
	})();

	return database;
}

export function closeDatabase(database: Database): void {
	try {
		database.close();
	} catch (_error) {
		// idempotent — already closed is fine
	}
}
