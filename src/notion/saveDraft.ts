import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { markdownToNotionBlocks } from "../utils/markdown.js";
import { notion } from "./client.js";
import type { DraftInput } from "./types.js";

export async function saveDraft(input: DraftInput): Promise<string> {
	// 1. ドラフトDBに新規ページを作成（プロパティのみ）
	const page = await notion.pages.create({
		parent: { database_id: config.notion.draftDbId },
		properties: {
			Title: {
				title: [{ text: { content: input.title } }],
			},
			Status: {
				status: { name: "レビュー待ち" },
			},
			SourceMemo: {
				relation: [{ id: input.sourceMemoId }],
			},
			Platform: {
				multi_select: input.platforms.map((p) => ({ name: p })),
			},
		},
	});

	// 2. 記事本文をページボディ（children blocks）として追加
	const blocks = markdownToNotionBlocks(input.body);

	// Notion APIは1回のリクエストで最大100ブロックまで追加可能
	const chunkSize = 100;
	for (let i = 0; i < blocks.length; i += chunkSize) {
		const chunk = blocks.slice(i, i + chunkSize);
		await notion.blocks.children.append({
			block_id: page.id,
			children: chunk,
		});
	}

	logger.info(`ドラフトを保存しました: ${input.title}`, { pageId: page.id });
	return page.id;
}
