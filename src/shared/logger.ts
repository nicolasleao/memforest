export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
	debug(message: string, context?: Record<string, unknown>): void;
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
	error(message: string, context?: Record<string, unknown>): void;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

function getConfiguredLevel(): LogLevel {
	const envLevel = process.env.MEMFOREST_LOG_LEVEL?.toLowerCase();
	if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
		return envLevel as LogLevel;
	}
	return "info";
}

function formatContext(context?: Record<string, unknown>): string {
	if (!context || Object.keys(context).length === 0) {
		return "";
	}
	return ` ${JSON.stringify(context)}`;
}

export function createLogger(domain: string): Logger {
	const write = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
		const configuredLevel = getConfiguredLevel();
		if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[configuredLevel]) {
			return;
		}
		const line = `[${level.toUpperCase()}] [${domain}] ${message}${formatContext(context)}`;
		process.stderr.write(`${line}\n`);
	};

	return {
		debug: (message, context) => write("debug", message, context),
		info: (message, context) => write("info", message, context),
		warn: (message, context) => write("warn", message, context),
		error: (message, context) => write("error", message, context),
	};
}
