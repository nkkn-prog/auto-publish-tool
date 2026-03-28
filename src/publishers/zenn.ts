import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { Draft, PublishResult } from "../notion/types.js";

function generateSlug(title: string): string {
	// タイトルからslugを生成（英数字・ハイフンのみ）
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
}

function generateFrontMatter(title: string, tags: string[]): string {
	const topics = tags.length > 0 ? tags.slice(0, 5) : ["tech"];
	return `---
title: "${title}"
emoji: "📝"
type: "tech"
topics: [${topics.map((t) => `"${t}"`).join(", ")}]
published: true
---`;
}

export async function publishToZenn(draft: Draft): Promise<PublishResult> {
	try {
		const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
		const slug = generateSlug(draft.title);
		const fileName = `${date}-${slug}.md`;

		const articlesDir = join(process.cwd(), "zenn", "articles");
		mkdirSync(articlesDir, { recursive: true });

		const filePath = join(articlesDir, fileName);
		const frontMatter = generateFrontMatter(draft.title, draft.platforms);
		const content = `${frontMatter}\n\n${draft.body}`;

		writeFileSync(filePath, content, "utf-8");

		// Zenn用リポジトリにpush
		const repo = config.zenn.repo;
		const pat = config.zenn.ghPat;
		const remoteUrl = pat
			? `https://${pat}@github.com/${repo}.git`
			: `https://github.com/${repo}.git`;

		execSync(`git add zenn/articles/${fileName}`, { stdio: "pipe" });
		execSync(`git commit -m "feat: add article ${fileName}"`, { stdio: "pipe" });
		execSync(`git push ${remoteUrl} HEAD:main`, { stdio: "pipe" });

		const zennUrl = `https://zenn.dev/${repo.split("/")[0]}/articles/${date}-${slug}`;

		logger.info(`Zennに記事を公開しました: ${zennUrl}`);
		return { platform: "Zenn", success: true, url: zennUrl };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error("Zennへの公開に失敗しました", error);
		return { platform: "Zenn", success: false, error: message };
	}
}
