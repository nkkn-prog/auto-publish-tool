import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/config.js", () => ({
	config: {
		notion: { apiToken: "test", memoDbId: "test", draftDbId: "test", xdraftDbId: "test" },
		anthropic: { apiKey: "test" },
		slack: { webhookUrl: "https://hooks.slack.com/services/test/test/test" },
		x: { apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "" },
		qiita: { accessToken: "" },
		zenn: { repo: "", ghPat: "" },
		note: { email: "", password: "", chromeProfilePath: "" },
	},
}));

import { sendSlackNotification } from "../src/notifications/slack.js";

describe("sendSlackNotification", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it("Slack通知を送信できる", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("ok", { status: 200 }),
		);

		await sendSlackNotification({
			title: "テスト通知",
			message: "テストメッセージ",
			notionUrl: "https://notion.so/test",
			tags: ["AI", "テスト"],
		});

		expect(globalThis.fetch).toHaveBeenCalledOnce();
		const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
		expect(url).toBe("https://hooks.slack.com/services/test/test/test");

		const body = JSON.parse((options as RequestInit).body as string);
		expect(body.blocks).toHaveLength(4); // header + section + actions + context
	});

	it("Webhook送信失敗時にエラーを投げる", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("invalid_payload", { status: 400, statusText: "Bad Request" }),
		);

		await expect(
			sendSlackNotification({ title: "テスト", message: "テスト" }),
		).rejects.toThrow("Slack通知の送信に失敗しました");
	});
});
