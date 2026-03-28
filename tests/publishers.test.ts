import { describe, it, expect, vi, beforeEach } from "vitest";

// configをモック
vi.mock("../src/config.js", () => ({
	config: {
		notion: {
			apiToken: "test",
			memoDbId: "test",
			draftDbId: "test",
			xdraftDbId: "test",
		},
		anthropic: { apiKey: "test" },
		slack: { webhookUrl: "https://hooks.slack.com/test" },
		x: {
			apiKey: "test-api-key",
			apiSecret: "test-api-secret",
			accessToken: "test-access-token",
			accessTokenSecret: "test-access-token-secret",
		},
		qiita: { accessToken: "test-qiita-token" },
		zenn: { repo: "testuser/zenn-content", ghPat: "ghp_test" },
		note: { email: "", password: "", chromeProfilePath: "" },
	},
}));

import { publishToQiita } from "../src/publishers/qiita.js";
import { publishToX } from "../src/publishers/x.js";
import { publishToNote } from "../src/publishers/note.js";
import type { Draft } from "../src/notion/types.js";

const testDraft: Draft = {
	id: "draft-1",
	title: "テスト記事",
	body: "# テスト\n\nこれはテスト記事です。",
	status: "承認済み",
	sourceMemoId: "memo-1",
	platforms: ["Zenn", "Qiita"],
};

describe("publishToQiita", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it("Qiitaに記事を投稿できる", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ url: "https://qiita.com/test/items/abc123" }), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const result = await publishToQiita(testDraft);

		expect(result.success).toBe(true);
		expect(result.url).toBe("https://qiita.com/test/items/abc123");
		expect(result.platform).toBe("Qiita");
	});

	it("APIエラー時に失敗結果を返す", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("Unauthorized", { status: 401 }),
		);

		const result = await publishToQiita(testDraft);

		expect(result.success).toBe(false);
		expect(result.error).toContain("401");
	});
});

describe("publishToX", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it("Xにツイートを投稿できる", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: { id: "12345" } }), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const result = await publishToX("テスト投稿 #AI");

		expect(result.success).toBe(true);
		expect(result.url).toBe("https://x.com/i/status/12345");
		expect(result.platform).toBe("X");
	});

	it("APIエラー時に失敗結果を返す", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("Rate limit exceeded", { status: 429 }),
		);

		const result = await publishToX("テスト投稿");

		expect(result.success).toBe(false);
		expect(result.error).toContain("429");
	});
});

describe("publishToNote", () => {
	it("未実装のためスキップ結果を返す", async () => {
		const result = await publishToNote(testDraft);

		expect(result.success).toBe(false);
		expect(result.platform).toBe("note");
		expect(result.error).toContain("未実装");
	});
});
