import { logger } from "../utils/logger.js";
import { notion } from "./client.js";
import type { DraftStatus, MemoStatus, XDraftStatus } from "./types.js";

export async function updateMemoStatus(pageId: string, status: MemoStatus): Promise<void> {
	await notion.pages.update({
		page_id: pageId,
		properties: {
			Status: { status: { name: status } },
		},
	});
	logger.info(`メモのステータスを更新: ${status}`, { pageId });
}

export async function updateDraftStatus(pageId: string, status: DraftStatus): Promise<void> {
	await notion.pages.update({
		page_id: pageId,
		properties: {
			Status: { status: { name: status } },
		},
	});
	logger.info(`ドラフトのステータスを更新: ${status}`, { pageId });
}

export async function updateXDraftStatus(pageId: string, status: XDraftStatus): Promise<void> {
	await notion.pages.update({
		page_id: pageId,
		properties: {
			Status: { status: { name: status } },
		},
	});
	logger.info(`X投稿ドラフトのステータスを更新: ${status}`, { pageId });
}
