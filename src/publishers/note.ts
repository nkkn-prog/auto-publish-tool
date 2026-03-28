import { logger } from "../utils/logger.js";
import type { Draft, PublishResult } from "../notion/types.js";

/**
 * note投稿モジュール（Sprint 4で実装予定）
 *
 * Browser Use CLI 2.0 または Playwright を使ったブラウザ自動化で
 * noteに記事を投稿する。公式APIがないためブラウザ操作が必要。
 */
export async function publishToNote(draft: Draft): Promise<PublishResult> {
	logger.warn("note投稿はSprint 4で実装予定です（現在はスキップ）");
	return {
		platform: "note",
		success: false,
		error: "note投稿モジュールは未実装です（Sprint 4で対応予定）",
	};
}
