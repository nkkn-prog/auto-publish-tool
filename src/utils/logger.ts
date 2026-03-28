type LogLevel = "info" | "warn" | "error" | "debug";

function formatTimestamp(): string {
	return new Date().toISOString();
}

function log(level: LogLevel, message: string, data?: unknown): void {
	const timestamp = formatTimestamp();
	const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

	if (data !== undefined) {
		console[level](`${prefix} ${message}`, data);
	} else {
		console[level](`${prefix} ${message}`);
	}
}

export const logger = {
	info: (message: string, data?: unknown) => log("info", message, data),
	warn: (message: string, data?: unknown) => log("warn", message, data),
	error: (message: string, data?: unknown) => log("error", message, data),
	debug: (message: string, data?: unknown) => log("debug", message, data),
};
