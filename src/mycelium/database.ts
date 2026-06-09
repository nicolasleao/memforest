import type { TenantContext } from "@memforest/shared";
import Database from "better-sqlite3";
import { ALL_SCHEMA } from "./schema.js";

export type Db = Database.Database;

export function openDatabase(tenant: TenantContext): Db {
	const database = new Database(tenant.databasePath);
	database.exec("PRAGMA journal_mode = WAL");
	return database;
}

export function initDatabase(tenant: TenantContext): Db {
	const database = openDatabase(tenant);

	database.transaction(() => {
		for (const sql of ALL_SCHEMA) {
			database.exec(sql);
		}
	})();

	return database;
}

export function closeDatabase(database: Db): void {
	try {
		database.close();
	} catch (_error) {
		// idempotent — already closed is fine
	}
}
