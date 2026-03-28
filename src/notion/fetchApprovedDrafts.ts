import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { notion } from "./client.js";
import type { Draft, Platform } from "./types.js";

// biome-ignore lint/suspicious/noExplicitAny: Notion APIの型が複雑なため
function getProperty(props: Record<string, any>, key: string): any {
	return props[key];
}

export async function fetchApprovedDrafts(): Promise<Draft[]> {
	const response = await notion.databases.query({
		database_id: config.notion.draftDbId,
		filter: {
			property: "Status",
			select: {
				equals: "承認済み",
			},
		},
	});

	const drafts: Draft[] = [];

	for (const page of response.results) {
		if (!("properties" in page)) continue;

		const props = page.properties;

		const titleProp = getProperty(props, "Title");
		const title =
			titleProp?.type === "title"
				? titleProp.title.map((t: { plain_text: string }) => t.plain_text).join("")
				: "";

		const platformProp = getProperty(props, "Platform");
		const platforms =
			platformProp?.type === "multi_select" && Array.isArray(platformProp.multi_select)
				? (platformProp.multi_select.map((p: { name: string }) => p.name) as Platform[])
				: [];

		const sourceMemoIdProp = getProperty(props, "SourceMemo");
		const sourceMemoId =
			sourceMemoIdProp?.type === "relation" && Array.isArray(sourceMemoIdProp.relation)
				? (sourceMemoIdProp.relation[0]?.id ?? "")
				: "";

		// ページ本文（children blocks）からテキストを取得
		const blocks = await notion.blocks.children.list({ block_id: page.id });
		const body = blocks.results
			.map((block) => {
				if (!("type" in block)) return "";
				// biome-ignore lint/suspicious/noExplicitAny: Notion block types
				const b = block as any;
				const blockData = b[b.type];
				if (blockData?.rich_text) {
					return blockData.rich_text
						.map((t: { plain_text: string }) => t.plain_text)
						.join("");
				}
				return "";
			})
			.filter(Boolean)
			.join("\n");

		drafts.push({
			id: page.id,
			title,
			body,
			status: "承認済み",
			sourceMemoId,
			platforms,
		});
	}

	if (drafts.length === 0) {
		logger.info("承認済みのドラフトはありません");
	} else {
		logger.info(`${drafts.length}件の承認済みドラフトを取得しました`);
	}

	return drafts;
}
