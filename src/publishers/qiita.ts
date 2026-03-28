import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { Draft, PublishResult } from "../notion/types.js";

interface QiitaTag {
	name: string;
	versions?: string[];
}

export async function publishToQiita(draft: Draft): Promise<PublishResult> {
	try {
		const tags: QiitaTag[] = draft.platforms.length > 0
			? draft.platforms.map((p) => ({ name: p }))
			: [{ name: "tech" }];

		const response = await fetch("https://qiita.com/api/v2/items", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config.qiita.accessToken}`,
			},
			body: JSON.stringify({
				title: draft.title,
				body: draft.body,
				private: false,
				tags,
			}),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`Qiita API error: ${response.status} ${errorBody}`);
		}

		const data = (await response.json()) as { url: string };

		logger.info(`Qiitaに記事を投稿しました: ${data.url}`);
		return { platform: "Qiita", success: true, url: data.url };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error("Qiitaへの投稿に失敗しました", error);
		return { platform: "Qiita", success: false, error: message };
	}
}
