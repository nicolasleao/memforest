import type { TenantContext } from "@memforest/shared";
import Database from "better-sqlite3";
import { ALL_SCHEMA } from "./schema.js";

export function openDatabase(tenant: TenantContext): Database.Database {
	const database = new Database(tenant.databasePath);
	database.pragma("journal_mode = WAL");
	return database;
}

export function initDatabase(tenant: TenantContext): Database.Database {
	const database = openDatabase(tenant);

	database.transaction(() => {
		for (const sql of ALL_SCHEMA) {
			database.exec(sql);
		}
	})();

	return database;
}

export function closeDatabase(database: Database.Database): void {
	try {
		database.close();
	} catch (_error) {
		// idempotent — already closed is fine
	}
}
