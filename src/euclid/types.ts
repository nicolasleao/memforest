import type { HealthReport, TenantContext } from "@memforest/shared";

export type EuclidMode = "chat" | "maintain";

export interface EuclidConfig {
	tenant: TenantContext;
	mode: EuclidMode;
	model?: string;
	verbose?: boolean;
}

export interface MaintenanceReport {
	health: HealthReport;
	actionsPerformed: MaintenanceAction[];
	summary: string;
}

export interface MaintenanceAction {
	type: "link_added" | "stale_flagged" | "orphan_linked" | "broken_link_fixed" | "reindexed";
	target: string;
	description: string;
}
