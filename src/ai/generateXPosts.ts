import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { Memo } from "../notion/types.js";
import { buildXPostPrompt } from "./prompts/xPostPrompt.js";

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

interface XPostsResult {
	xPost1: string;
	xPost2: string;
	xPost3: string;
}

export async function generateXPosts(memo: Memo): Promise<XPostsResult> {
	const prompt = buildXPostPrompt(memo);

	const message = await anthropic.messages.create({
		model: "claude-sonnet-4-6-20250514",
		max_tokens: 1024,
		messages: [{ role: "user", content: prompt }],
	});

	const text = message.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("");

	const parsed = parseJsonFromResponse<XPostsResult>(text);

	if (!parsed.xPost1 || !parsed.xPost2 || !parsed.xPost3) {
		throw new Error("Claude APIのレスポンスにX投稿文が含まれていません");
	}

	logger.info("X投稿文を生成しました（3パターン）");
	return parsed;
}

function parseJsonFromResponse<T>(text: string): T {
	const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
	if (jsonBlockMatch) {
		return JSON.parse(jsonBlockMatch[1].trim());
	}
	return JSON.parse(text.trim());
}
