import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { Memo } from "../notion/types.js";

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

export interface FactCheckResult {
	hasIssues: boolean;
	issues: string[];
}

export async function factCheck(memo: Memo): Promise<FactCheckResult> {
	const prompt = `あなたは技術的な正確性を検証する専門家です。

以下のメモは筆者が実務で得た知見です。
Web検索を使って、メモ内の事実関係（技術用語、バージョン、API仕様など）に明確な誤りがないか検証してください。

## 重要なルール
- メモの内容を書き換えたり、情報を追加したりしないでください
- 筆者の経験や意見・感想は検証対象外です（それは筆者だけが知る事実です）
- 指摘するのは、Web検索で確認できる客観的事実との矛盾のみです
  例: 「○○はv3で廃止されたが、メモではv4で使えると記載」
  例: 「○○のデフォルト値は10ではなく20」

## メモ情報
- タイトル: ${memo.title}
- 内容: ${memo.content}
- タグ: ${memo.tags.join(", ") || "技術"}

## 出力形式
以下の形式で出力してください。他のテキストは含めないでください。

---ISSUES---
客観的事実に反する誤りを箇条書きで記載（各項目に検索で確認した根拠も簡潔に添える）
誤りがなければ「なし」とだけ記載`;

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

	const issuesMatch = text.match(/---ISSUES---\s*([\s\S]*)/);

	if (!issuesMatch) {
		logger.warn("ファクトチェックの結果をパースできませんでした");
		return { hasIssues: false, issues: [] };
	}

	const issuesText = issuesMatch[1].trim();
	const issues = issuesText === "なし" ? [] : issuesText.split("\n").filter((line) => line.trim());

	if (issues.length > 0) {
		logger.warn(`ファクトチェックで ${issues.length} 件の事実誤認を検出しました:`);
		for (const issue of issues) {
			logger.warn(`  ${issue}`);
		}
	} else {
		logger.info("ファクトチェック: 事実誤認なし");
	}

	return { hasIssues: issues.length > 0, issues };
}
