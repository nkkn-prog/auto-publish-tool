import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { Memo } from "../notion/types.js";

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

export interface FactCheckResult {
	correctedContent: string;
	issues: string[];
}

export async function factCheck(memo: Memo): Promise<FactCheckResult> {
	const prompt = `あなたは技術的な正確性を検証する専門家です。

以下のメモの内容を技術的な観点からファクトチェックしてください。
必ずWeb検索を使って、最新の公式ドキュメントやリリース情報を確認してください。

## メモ情報
- タイトル: ${memo.title}
- 内容: ${memo.content}
- タグ: ${memo.tags.join(", ") || "技術"}

## 検証のポイント
1. Web検索で最新の公式情報・ドキュメントを確認する
2. 技術用語や概念が正しく使われているか
3. バージョン情報や仕様が最新かつ正確か
4. 因果関係や比較が正確か
5. 誤解を招く表現がないか

## 出力形式
以下の形式で出力してください。他のテキストは含めないでください。

---ISSUES---
発見した問題点を箇条書きで記載（問題がなければ「なし」）
---CORRECTED---
問題点を修正し、最新の情報で補完したメモ内容（元の意図を保ちつつ、技術的に正確な内容にする）`;

	// biome-ignore lint/suspicious/noExplicitAny: Anthropic SDK の型が web_search ツールに未対応のため
	const message = await (anthropic.messages.create as any)({
		model: "claude-sonnet-4-5-20250929",
		max_tokens: 4096,
		tools: [
			{
				type: "web_search_20250305",
				name: "web_search",
				max_uses: 5,
			},
		],
		messages: [{ role: "user", content: prompt }],
	});

	const text = message.content
		.filter((block: { type: string }) => block.type === "text")
		.map((block: { type: string; text: string }) => block.text)
		.join("");

	const issuesMatch = text.match(/---ISSUES---\s*([\s\S]*?)\s*---CORRECTED---/);
	const correctedMatch = text.match(/---CORRECTED---\s*([\s\S]*)/);

	if (!issuesMatch || !correctedMatch) {
		logger.warn("ファクトチェックの結果をパースできませんでした。元のメモ内容を使用します。");
		return { correctedContent: memo.content, issues: [] };
	}

	const issuesText = issuesMatch[1].trim();
	const issues = issuesText === "なし" ? [] : issuesText.split("\n").filter((line) => line.trim());

	if (issues.length > 0) {
		logger.info(`ファクトチェックで ${issues.length} 件の問題を検出しました`);
	} else {
		logger.info("ファクトチェック: 問題なし");
	}

	return {
		correctedContent: correctedMatch[1].trim(),
		issues,
	};
}
