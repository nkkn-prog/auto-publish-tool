import { fetchMemos } from "../notion/fetchMemos.js";
import { saveDraft } from "../notion/saveDraft.js";
import { saveXDraft } from "../notion/saveXDraft.js";
import { updateMemoStatus } from "../notion/updateStatus.js";
import { factCheck } from "../ai/factCheck.js";
import { generateDraft } from "../ai/generateDraft.js";
import { generateXPosts } from "../ai/generateXPosts.js";
import { sendSlackNotification } from "../notifications/slack.js";
import { logger } from "../utils/logger.js";

const MAX_RETRIES = 3;

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			return await fn();
		} catch (error) {
			logger.warn(`${label} 失敗 (${attempt}/${MAX_RETRIES})`, error);
			if (attempt === MAX_RETRIES) throw error;
			// 指数バックオフ: 1s, 2s, 4s
			await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
		}
	}
	throw new Error("unreachable");
}

async function main() {
	logger.info("=== ドラフト生成パイプライン開始 ===");

	// 1. 未処理メモを取得
	const memos = await fetchMemos();
	if (memos.length === 0) {
		logger.info("処理対象のメモがないため終了します");
		return;
	}

	for (const memo of memos) {
		try {
			// 2. ステータスを「生成中」に更新
			await updateMemoStatus(memo.id, "生成中");

			// 3. ファクトチェック（Web検索で事実誤認を検出）
			const factCheckResult = await withRetry(() => factCheck(memo), "ファクトチェック");

			if (factCheckResult.hasIssues) {
				// 事実誤認があればSlackで通知し、記事生成をスキップ
				await updateMemoStatus(memo.id, "未処理");
				await sendSlackNotification({
					title: "ファクトチェックで事実誤認が検出されました",
					message: `*メモ:* ${memo.title}\n\n*指摘事項:*\n${factCheckResult.issues.join("\n")}`,
					tags: memo.tags,
				});
				logger.warn(`メモ "${memo.title}" にファクトチェック指摘あり。メモを修正してください。`);
				continue;
			}

			// 4. Claude APIで記事ドラフト + X投稿文を並行生成
			const [article, xPosts] = await Promise.all([
				withRetry(() => generateDraft(memo), "記事ドラフト生成"),
				withRetry(() => generateXPosts(memo), "X投稿文生成"),
			]);

			// 4. ドラフトDBに保存
			const draftPageId = await withRetry(
				() =>
					saveDraft({
						title: article.title,
						body: article.body,
						sourceMemoId: memo.id,
						platforms: ["Zenn", "Qiita", "note"],
					}),
				"ドラフト保存",
			);

			// 5. X投稿ドラフトDBに保存
			await withRetry(
				() =>
					saveXDraft({
						title: article.title,
						xPost1: xPosts.xPost1,
						xPost2: xPosts.xPost2,
						xPost3: xPosts.xPost3,
						sourceMemoId: memo.id,
					}),
				"X投稿ドラフト保存",
			);

			// 6. メモのステータスを「完了」に更新
			await updateMemoStatus(memo.id, "完了");

			// 7. Slack通知
			const notionUrl = `https://notion.so/${draftPageId.replace(/-/g, "")}`;
			await sendSlackNotification({
				title: "新しいドラフトが生成されました",
				message: `*${article.title}*\n元メモ: ${memo.title}`,
				notionUrl,
				tags: memo.tags,
			});

			logger.info(`メモ "${memo.title}" の処理が完了しました`);
		} catch (error) {
			logger.error(`メモ "${memo.title}" の処理に失敗しました`, error);

			// 失敗通知をSlackに送信
			try {
				await sendSlackNotification({
					title: "ドラフト生成に失敗しました",
					message: `*メモ:* ${memo.title}\n*エラー:* ${error instanceof Error ? error.message : String(error)}`,
					tags: memo.tags,
				});
			} catch (notifyError) {
				logger.error("Slack通知の送信にも失敗しました", notifyError);
			}
		}
	}

	logger.info("=== ドラフト生成パイプライン完了 ===");
}

main().catch((error) => {
	logger.error("パイプラインが予期しないエラーで終了しました", error);
	process.exit(1);
});
