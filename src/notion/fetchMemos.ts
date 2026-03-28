import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { notion } from "./client.js";
import type { Memo } from "./types.js";

// Notion APIのプロパティ値を安全に取得するヘルパー
// biome-ignore lint/suspicious/noExplicitAny: Notion APIの型が複雑なため
function getProperty(props: Record<string, any>, key: string): any {
	return props[key];
}

export async function fetchMemos(): Promise<Memo[]> {
	const response = await notion.databases.query({
		database_id: config.notion.memoDbId,
		filter: {
			property: "Status",
			status: {
				equals: "未処理",
			},
		},
		sorts: [{ timestamp: "created_time", direction: "ascending" }],
	});

	const memos: Memo[] = response.results.map((page) => {
		if (!("properties" in page)) {
			throw new Error("Unexpected page format");
		}

		const props = page.properties;

		const titleProp = getProperty(props, "Title");
		const title =
			titleProp?.type === "title"
				? titleProp.title.map((t: { plain_text: string }) => t.plain_text).join("")
				: "";

		const contentProp = getProperty(props, "Content");
		const content =
			contentProp?.type === "rich_text"
				? contentProp.rich_text.map((t: { plain_text: string }) => t.plain_text).join("")
				: "";

		const tagsProp = getProperty(props, "Tags");
		const tags =
			tagsProp?.type === "multi_select" && Array.isArray(tagsProp.multi_select)
				? tagsProp.multi_select.map((t: { name: string }) => t.name)
				: [];

		const statusProp = getProperty(props, "Status");
		const status =
			statusProp?.type === "status" ? (statusProp.status?.name ?? "未処理") : "未処理";

		return {
			id: page.id,
			title,
			content,
			tags,
			status: status as Memo["status"],
			createdAt: "created_time" in page ? page.created_time : "",
		};
	});

	if (memos.length === 0) {
		logger.info("未処理のメモはありません");
	} else {
		logger.info(`${memos.length}件の未処理メモを取得しました`);
	}

	return memos;
}
