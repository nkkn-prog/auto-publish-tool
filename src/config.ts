import "dotenv/config";

function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function optionalEnv(key: string, defaultValue = ""): string {
	return process.env[key] ?? defaultValue;
}

export const config = {
	notion: {
		apiToken: requireEnv("NOTION_API_TOKEN"),
		memoDbId: requireEnv("NOTION_MEMO_DB_ID"),
		draftDbId: requireEnv("NOTION_DRAFT_DB_ID"),
		xdraftDbId: requireEnv("NOTION_XDRAFT_DB_ID"),
	},
	anthropic: {
		apiKey: requireEnv("ANTHROPIC_API_KEY"),
	},
	slack: {
		webhookUrl: requireEnv("SLACK_WEBHOOK_URL"),
	},
	x: {
		apiKey: requireEnv("X_API_KEY"),
		apiSecret: requireEnv("X_API_SECRET"),
		accessToken: requireEnv("X_ACCESS_TOKEN"),
		accessTokenSecret: requireEnv("X_ACCESS_TOKEN_SECRET"),
	},
	qiita: {
		accessToken: requireEnv("QIITA_ACCESS_TOKEN"),
	},
	zenn: {
		repo: requireEnv("ZENN_REPO"),
		ghPat: optionalEnv("GH_PAT"),
	},
	note: {
		email: optionalEnv("NOTE_EMAIL"),
		password: optionalEnv("NOTE_PASSWORD"),
		chromeProfilePath: optionalEnv("NOTE_CHROME_PROFILE_PATH"),
	},
} as const;
