import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Memo } from "../src/notion/types.js";

const mockCreate = vi.hoisted(() => vi.fn());

// configをモック
vi.mock("../src/config.js", () => ({
	config: {
		anthropic: { apiKey: "test-key" },
		notion: {
			apiToken: "test",
			memoDbId: "test",
			draftDbId: "test",
			xdraftDbId: "test",
		},
		slack: { webhookUrl: "https://hooks.slack.com/test" },
		x: { apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "" },
		qiita: { accessToken: "" },
		zenn: { repo: "", ghPat: "" },
		note: { email: "", password: "", chromeProfilePath: "" },
	},
}));

// Anthropic SDKをモック
vi.mock("@anthropic-ai/sdk", () => ({
	default: vi.fn().mockImplementation(() => ({
		messages: { create: mockCreate },
	})),
}));

import { generateDraft } from "../src/ai/generateDraft.js";
import { generateXPosts } from "../src/ai/generateXPosts.js";

const testMemo: Memo = {
	id: "memo-1",
	title: "Claude APIのプロンプトチューニング",
	content: "Claude APIでプロンプトを調整したら、回答精度が30%向上した。ポイントはfew-shot examplesの質。",
	tags: ["Claude", "AI開発", "チューニング"],
	status: "未処理",
	createdAt: "2026-03-24T00:00:00.000Z",
};

describe("generateDraft", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("メモから記事ドラフトを生成できる", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: '```json\n{"title": "プロンプトチューニングで回答精度30%向上", "body": "# はじめに\\n\\nテスト記事本文"}\n```',
				},
			],
		});

		const result = await generateDraft(testMemo);

		expect(result.title).toBe("プロンプトチューニングで回答精度30%向上");
		expect(result.body).toContain("テスト記事本文");
		expect(mockCreate).toHaveBeenCalledOnce();
	});

	it("JSONブロックなしでも直接パースできる", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: '{"title": "テスト記事", "body": "本文"}',
				},
			],
		});

		const result = await generateDraft(testMemo);
		expect(result.title).toBe("テスト記事");
	});

	it("titleが欠落していた場合エラーになる", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: '{"body": "本文のみ"}' }],
		});

		await expect(generateDraft(testMemo)).rejects.toThrow(
			"title または body が含まれていません",
		);
	});
});

describe("generateXPosts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("メモからX投稿文3パターンを生成できる", async () => {
		mockCreate.mockResolvedValue({
			content: [
				{
					type: "text",
					text: '```json\n{"xPost1": "問いかけ型の投稿", "xPost2": "数字型の投稿", "xPost3": "ストーリー型の投稿"}\n```',
				},
			],
		});

		const result = await generateXPosts(testMemo);

		expect(result.xPost1).toBe("問いかけ型の投稿");
		expect(result.xPost2).toBe("数字型の投稿");
		expect(result.xPost3).toBe("ストーリー型の投稿");
	});

	it("投稿文が欠落していた場合エラーになる", async () => {
		mockCreate.mockResolvedValue({
			content: [{ type: "text", text: '{"xPost1": "投稿1のみ"}' }],
		});

		await expect(generateXPosts(testMemo)).rejects.toThrow(
			"X投稿文が含まれていません",
		);
	});
});
