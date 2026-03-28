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
	const jsonText = jsonBlockMatch ? jsonBlockMatch[1].trim() : text.trim();

	try {
		return JSON.parse(jsonText);
	} catch {
		// JSON文字列内の生の改行をエスケープしてリトライ
		const fixed = jsonText.replace(/"([^"]*?)"/gs, (_match, content: string) => {
			const escaped = content
				.replace(/\\/g, "\\\\")
				.replace(/\n/g, "\\n")
				.replace(/\r/g, "\\r")
				.replace(/\t/g, "\\t");
			return `"${escaped}"`;
		});
		return JSON.parse(fixed);
	}
}
