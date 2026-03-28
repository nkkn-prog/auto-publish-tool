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

## メモ情報
- タイトル: ${memo.title}
- 内容: ${memo.content}
- タグ: ${memo.tags.join(", ") || "技術"}

## 検証のポイント
1. 技術用語や概念が正しく使われているか
2. バージョン情報や仕様に誤りがないか
3. 因果関係や比較が正確か
4. 誤解を招く表現がないか

## 出力形式
以下の形式で出力してください。他のテキストは含めないでください。

---ISSUES---
発見した問題点を箇条書きで記載（問題がなければ「なし」）
---CORRECTED---
問題点を修正し、不足している情報を補完したメモ内容（元の意図を保ちつつ、技術的に正確な内容にする）`;

	const message = await anthropic.messages.create({
		model: "claude-sonnet-4-5-20250929",
		max_tokens: 4096,
		messages: [{ role: "user", content: prompt }],
	});

	const text = message.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
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
