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
		model: "claude-sonnet-4-5-20250929",
		max_tokens: 16384,
		messages: [{ role: "user", content: prompt }],
	});

	const text = message.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("");

	const parsed = parseDelimitedResponse(text);

	if (!parsed.title || !parsed.body) {
		throw new Error("Claude APIのレスポンスに title または body が含まれていません");
	}

	logger.info(`記事ドラフトを生成しました: ${parsed.title}`);
	return parsed;
}

function parseDelimitedResponse(text: string): ArticleResult {
	const titleMatch = text.match(/---TITLE---\s*([\s\S]*?)\s*---BODY---/);
	const bodyMatch = text.match(/---BODY---\s*([\s\S]*)/);

	if (!titleMatch || !bodyMatch) {
		throw new Error("Claude APIのレスポンスが期待する形式ではありません");
	}

	return {
		title: titleMatch[1].trim(),
		body: bodyMatch[1].trim(),
	};
}
