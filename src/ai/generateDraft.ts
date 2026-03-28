import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { Memo } from "../notion/types.js";
import { buildArticlePrompt } from "./prompts/articlePrompt.js";

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

interface ArticleResult {
	title: string;
	body: string;
}

export async function generateDraft(memo: Memo): Promise<ArticleResult> {
	const prompt = buildArticlePrompt(memo);

	const message = await anthropic.messages.create({
		model: "claude-sonnet-4-6-20250514",
		max_tokens: 4096,
		messages: [{ role: "user", content: prompt }],
	});

	const text = message.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("");

	const parsed = parseJsonFromResponse<ArticleResult>(text);

	if (!parsed.title || !parsed.body) {
		throw new Error("Claude APIのレスポンスに title または body が含まれていません");
	}

	logger.info(`記事ドラフトを生成しました: ${parsed.title}`);
	return parsed;
}

function parseJsonFromResponse<T>(text: string): T {
	// ```json ... ``` ブロックから抽出を試みる
	const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
	if (jsonBlockMatch) {
		return JSON.parse(jsonBlockMatch[1].trim());
	}

	// JSON全体を直接パース
	return JSON.parse(text.trim());
}
