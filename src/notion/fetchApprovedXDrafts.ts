import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { notion } from "./client.js";
import type { XDraft } from "./types.js";

// biome-ignore lint/suspicious/noExplicitAny: Notion APIの型が複雑なため
function getProperty(props: Record<string, any>, key: string): any {
	return props[key];
}

export async function fetchApprovedXDrafts(): Promise<XDraft[]> {
	const response = await notion.databases.query({
		database_id: config.notion.xdraftDbId,
		filter: {
			property: "Status",
			status: {
				equals: "承認済み",
			},
		},
	});

	const xDrafts: XDraft[] = response.results.map((page) => {
		if (!("properties" in page)) {
			throw new Error("Unexpected page format");
		}

		const props = page.properties;

		const titleProp = getProperty(props, "Title");
		const title =
			titleProp?.type === "title"
				? titleProp.title.map((t: { plain_text: string }) => t.plain_text).join("")
				: "";

		const getRichText = (propName: string): string => {
			const prop = getProperty(props, propName);
			return prop?.type === "rich_text" && Array.isArray(prop.rich_text)
				? prop.rich_text.map((t: { plain_text: string }) => t.plain_text).join("")
				: "";
		};

		const sourceMemoIdProp = getProperty(props, "SourceMemo");
		const sourceMemoId =
			sourceMemoIdProp?.type === "relation" && Array.isArray(sourceMemoIdProp.relation)
				? (sourceMemoIdProp.relation[0]?.id ?? "")
				: "";

		const scheduledAtProp = getProperty(props, "ScheduledAt");
		const scheduledAt =
			scheduledAtProp?.type === "date" ? (scheduledAtProp.date?.start ?? null) : null;

		return {
			id: page.id,
			title,
			xPost1: getRichText("XPost_1"),
			xPost2: getRichText("XPost_2"),
			xPost3: getRichText("XPost_3"),
			status: "承認済み" as const,
			sourceMemoId,
			scheduledAt,
		};
	});

	if (xDrafts.length === 0) {
		logger.info("承認済みのX投稿ドラフトはありません");
	} else {
		logger.info(`${xDrafts.length}件の承認済みX投稿ドラフトを取得しました`);
	}

	return xDrafts;
}
