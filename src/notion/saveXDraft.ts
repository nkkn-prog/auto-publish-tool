import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { notion } from "./client.js";
import type { XDraftInput } from "./types.js";

export async function saveXDraft(input: XDraftInput): Promise<string> {
	const page = await notion.pages.create({
		parent: { database_id: config.notion.xdraftDbId },
		properties: {
			Title: {
				title: [{ text: { content: input.title } }],
			},
			XPost_1: {
				rich_text: [{ text: { content: input.xPost1 } }],
			},
			XPost_2: {
				rich_text: [{ text: { content: input.xPost2 } }],
			},
			XPost_3: {
				rich_text: [{ text: { content: input.xPost3 } }],
			},
			Status: {
				status: { name: "未承認" },
			},
			SourceMemo: {
				relation: [{ id: input.sourceMemoId }],
			},
		},
	});

	logger.info(`X投稿ドラフトを保存しました: ${input.title}`, { pageId: page.id });
	return page.id;
}
