import { listBranches } from "@memforest/forest";
import type { HealthReport, TenantContext } from "@memforest/shared";
import type Database from "better-sqlite3";
import { ANSI, clearMainArea, writeAt } from "../render.js";

export function computeHealthReport(
	database: Database.Database,
	tenant: TenantContext,
): HealthReport {
	const branches = listBranches(tenant);

	const indexedRow = database.prepare("SELECT COUNT(*) as count FROM branches").get() as {
		count: number;
	};
	const indexedCount = indexedRow.count;

	const edgesRow = database.prepare("SELECT COUNT(*) as count FROM edges").get() as {
		count: number;
	};
	const totalEdges = edgesRow.count;

	const brokenRows = database
		.prepare("SELECT target_path FROM edges WHERE target_resolved = 0")
		.all() as { target_path: string }[];
	const brokenLinks = brokenRows.map((r) => r.target_path);

	const staleRow = database
		.prepare("SELECT COUNT(*) as count FROM branches WHERE status = 'stale'")
		.get() as { count: number };
	const staleCount = staleRow.count;

	const orphanRows = database
		.prepare(
			`SELECT relative_path FROM branches
			 WHERE relative_path NOT IN (SELECT source_path FROM edges)
			   AND relative_path NOT IN (SELECT target_path FROM edges)`,
		)
		.all() as { relative_path: string }[];
	const orphanBranches = orphanRows.map((r) => r.relative_path);

	return {
		totalBranches: branches.length,
		totalEdges,
		orphanBranches,
		brokenLinks,
		staleCount,
		indexedCount,
		unindexedCount: branches.length - indexedCount,
	};
}

export function renderHealthView(
	report: HealthReport,
	forestName: string,
	rows: number,
	cols: number,
): void {
	const startRow = 3;
	const endRow = rows - 2;

	clearMainArea(startRow, endRow, cols);

	let line = 0;

	writeAt(startRow + line, 2, `${ANSI.bold}Forest Health: ${forestName}${ANSI.reset}`);
	line++;
	writeAt(startRow + line, 2, `${ANSI.dim}${"─".repeat(40)}${ANSI.reset}`);
	line++;
	line++;

	// Summary stats
	const unindexedLabel =
		report.unindexedCount > 0
			? ` ${ANSI.yellow}(${report.unindexedCount} unindexed)${ANSI.reset}`
			: "";
	writeAt(
		startRow + line,
		2,
		`  Branches:    ${ANSI.bold}${report.totalBranches}${ANSI.reset} total${unindexedLabel}`,
	);
	line++;

	const brokenLabel =
		report.brokenLinks.length > 0
			? ` ${ANSI.red}(${report.brokenLinks.length} broken)${ANSI.reset}`
			: "";
	writeAt(
		startRow + line,
		2,
		`  Edges:       ${ANSI.bold}${report.totalEdges}${ANSI.reset} total${brokenLabel}`,
	);
	line++;

	const orphanColor = report.orphanBranches.length > 0 ? ANSI.yellow : "";
	const orphanReset = report.orphanBranches.length > 0 ? ANSI.reset : "";
	writeAt(
		startRow + line,
		2,
		`  Orphans:     ${orphanColor}${ANSI.bold}${report.orphanBranches.length}${ANSI.reset}${orphanReset}`,
	);
	line++;

	const staleColor = report.staleCount > 0 ? ANSI.yellow : "";
	const staleReset = report.staleCount > 0 ? ANSI.reset : "";
	writeAt(
		startRow + line,
		2,
		`  Stale:       ${staleColor}${ANSI.bold}${report.staleCount}${ANSI.reset}${staleReset}`,
	);
	line++;
	line++;

	// Broken links
	if (report.brokenLinks.length > 0) {
		writeAt(startRow + line, 2, `${ANSI.red}${ANSI.bold}Broken Links:${ANSI.reset}`);
		line++;
		for (const link of report.brokenLinks) {
			if (startRow + line >= endRow) break;
			writeAt(startRow + line, 4, `${ANSI.red}- [[${link}]]${ANSI.reset}`);
			line++;
		}
		line++;
	}

	// Orphan branches
	if (report.orphanBranches.length > 0) {
		writeAt(startRow + line, 2, `${ANSI.yellow}${ANSI.bold}Orphan Branches:${ANSI.reset}`);
		line++;
		for (const orphan of report.orphanBranches) {
			if (startRow + line >= endRow) break;
			writeAt(startRow + line, 4, `${ANSI.yellow}- ${orphan}${ANSI.reset}`);
			line++;
		}
	}

	// If everything is clean
	if (
		report.brokenLinks.length === 0 &&
		report.orphanBranches.length === 0 &&
		report.staleCount === 0
	) {
		writeAt(
			startRow + line,
			2,
			`${ANSI.green}${ANSI.bold}All clear! Your forest is healthy.${ANSI.reset}`,
		);
	}
}
