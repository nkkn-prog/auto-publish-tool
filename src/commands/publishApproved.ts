import { fetchApprovedDrafts } from "../notion/fetchApprovedDrafts.js";
import { fetchApprovedXDrafts } from "../notion/fetchApprovedXDrafts.js";
import { updateDraftStatus, updateXDraftStatus } from "../notion/updateStatus.js";
import { publishToZenn } from "../publishers/zenn.js";
import { publishToQiita } from "../publishers/qiita.js";
import { publishToX } from "../publishers/x.js";
import { publishToNote } from "../publishers/note.js";
import { sendSlackNotification } from "../notifications/slack.js";
import { logger } from "../utils/logger.js";
import type { Draft, PublishResult } from "../notion/types.js";

async function publishDraft(draft: Draft): Promise<void> {
	await updateDraftStatus(draft.id, "投稿中");

	const results: PublishResult[] = [];

	// 各プラットフォームに並行投稿
	const publishTasks: Promise<PublishResult>[] = [];

	for (const platform of draft.platforms) {
		switch (platform) {
			case "Zenn":
				publishTasks.push(publishToZenn(draft));
				break;
			case "Qiita":
				publishTasks.push(publishToQiita(draft));
				break;
			case "note":
				publishTasks.push(publishToNote(draft));
				break;
		}
	}

	const settledResults = await Promise.allSettled(publishTasks);

	for (const result of settledResults) {
		if (result.status === "fulfilled") {
			results.push(result.value);
		} else {
			results.push({
				platform: "unknown",
				success: false,
				error: result.reason instanceof Error ? result.reason.message : String(result.reason),
			});
		}
	}

	const allSuccess = results.every((r) => r.success);
	const failures = results.filter((r) => !r.success);

	if (allSuccess) {
		await updateDraftStatus(draft.id, "投稿完了");
		const urls = results.map((r) => `${r.platform}: ${r.url}`).join("\n");
		await sendSlackNotification({
			title: "記事を投稿しました",
			message: `*${draft.title}*\n${urls}`,
		});
	} else {
		await updateDraftStatus(draft.id, "投稿失敗");
		const failureDetails = failures
			.map((f) => `${f.platform}: ${f.error}`)
			.join("\n");
		await sendSlackNotification({
			title: "記事投稿に一部失敗しました",
			message: `*${draft.title}*\n失敗:\n${failureDetails}`,
		});
	}
}

async function publishXDrafts(): Promise<void> {
	const xDrafts = await fetchApprovedXDrafts();

	for (const xDraft of xDrafts) {
		try {
			await updateXDraftStatus(xDraft.id, "投稿済み");

			// 3パターンの投稿文を時差投稿（即時 → 1分後 → 2分後）
			const posts = [xDraft.xPost1, xDraft.xPost2, xDraft.xPost3].filter(Boolean);

			for (let i = 0; i < posts.length; i++) {
				if (i > 0) {
					await new Promise((resolve) => setTimeout(resolve, 60_000));
				}
				const result = await publishToX(posts[i]);
				if (!result.success) {
					logger.error(`X投稿失敗 (パターン${i + 1}): ${result.error}`);
				}
			}

			logger.info(`X投稿完了: ${xDraft.title}`);
		} catch (error) {
			logger.error(`X投稿ドラフト "${xDraft.title}" の処理に失敗`, error);
			await sendSlackNotification({
				title: "X投稿に失敗しました",
				message: `*${xDraft.title}*\n${error instanceof Error ? error.message : String(error)}`,
			});
		}
	}
}

async function main() {
	logger.info("=== 承認済みコンテンツ投稿パイプライン開始 ===");

	// 記事ドラフトの投稿
	const drafts = await fetchApprovedDrafts();
	for (const draft of drafts) {
		await publishDraft(draft);
	}

	// X投稿ドラフトの投稿
	await publishXDrafts();

	logger.info("=== 承認済みコンテンツ投稿パイプライン完了 ===");
}

main().catch((error) => {
	logger.error("パイプラインが予期しないエラーで終了しました", error);
	process.exit(1);
});
