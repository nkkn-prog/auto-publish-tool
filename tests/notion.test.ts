import { describe, it, expect, vi, beforeEach } from "vitest";

// Notion clientをモック
vi.mock("../src/notion/client.js", () => ({
	notion: {
		databases: {
			query: vi.fn(),
		},
		pages: {
			create: vi.fn(),
			update: vi.fn(),
		},
		blocks: {
			children: {
				append: vi.fn(),
				list: vi.fn(),
			},
		},
	},
}));

// configをモック
vi.mock("../src/config.js", () => ({
	config: {
		notion: {
			apiToken: "test-token",
			memoDbId: "test-memo-db-id",
			draftDbId: "test-draft-db-id",
			xdraftDbId: "test-xdraft-db-id",
		},
	},
}));

import { notion } from "../src/notion/client.js";
import { fetchMemos } from "../src/notion/fetchMemos.js";
import { saveDraft } from "../src/notion/saveDraft.js";
import { saveXDraft } from "../src/notion/saveXDraft.js";
import { fetchApprovedDrafts } from "../src/notion/fetchApprovedDrafts.js";
import { fetchApprovedXDrafts } from "../src/notion/fetchApprovedXDrafts.js";
import { updateMemoStatus, updateDraftStatus, updateXDraftStatus } from "../src/notion/updateStatus.js";

const mockNotion = vi.mocked(notion);

describe("fetchMemos", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("未処理のメモを取得できる", async () => {
		mockNotion.databases.query.mockResolvedValue({
			results: [
				{
					id: "memo-1",
					object: "page",
					created_time: "2026-03-24T00:00:00.000Z",
					last_edited_time: "2026-03-24T00:00:00.000Z",
					archived: false,
					in_trash: false,
					url: "",
					public_url: null,
					parent: { type: "database_id", database_id: "test-db" },
					icon: null,
					cover: null,
					properties: {
						Title: {
							type: "title",
							title: [{ plain_text: "テストメモ", type: "text", text: { content: "テストメモ", link: null }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" }, href: null }],
							id: "title",
						},
						Content: {
							type: "rich_text",
							rich_text: [{ plain_text: "メモの内容", type: "text", text: { content: "メモの内容", link: null }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" }, href: null }],
							id: "content",
						},
						Tags: {
							type: "multi_select",
							multi_select: [{ id: "1", name: "AI開発", color: "blue" }],
							id: "tags",
						},
						Status: {
							type: "select",
							select: { id: "1", name: "未処理", color: "gray" },
							id: "status",
						},
					},
				},
			],
			has_more: false,
			next_cursor: null,
			type: "page_or_database",
			page_or_database: {},
		} as never);

		const memos = await fetchMemos();

		expect(memos).toHaveLength(1);
		expect(memos[0].title).toBe("テストメモ");
		expect(memos[0].content).toBe("メモの内容");
		expect(memos[0].tags).toEqual(["AI開発"]);
		expect(memos[0].status).toBe("未処理");
	});

	it("未処理のメモがない場合は空配列を返す", async () => {
		mockNotion.databases.query.mockResolvedValue({
			results: [],
			has_more: false,
			next_cursor: null,
			type: "page_or_database",
			page_or_database: {},
		} as never);

		const memos = await fetchMemos();
		expect(memos).toHaveLength(0);
	});
});

describe("saveDraft", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("ドラフトをNotionに保存できる", async () => {
		mockNotion.pages.create.mockResolvedValue({
			id: "draft-page-1",
			object: "page",
		} as never);
		mockNotion.blocks.children.append.mockResolvedValue({
			results: [],
		} as never);

		const pageId = await saveDraft({
			title: "テスト記事",
			body: "# テスト\n\nこれはテストです。",
			sourceMemoId: "memo-1",
			platforms: ["Zenn", "Qiita"],
		});

		expect(pageId).toBe("draft-page-1");
		expect(mockNotion.pages.create).toHaveBeenCalledOnce();
		expect(mockNotion.blocks.children.append).toHaveBeenCalled();
	});
});

describe("saveXDraft", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("X投稿ドラフトをNotionに保存できる", async () => {
		mockNotion.pages.create.mockResolvedValue({
			id: "xdraft-page-1",
			object: "page",
		} as never);

		const pageId = await saveXDraft({
			title: "テスト投稿",
			xPost1: "投稿パターン1",
			xPost2: "投稿パターン2",
			xPost3: "投稿パターン3",
			sourceMemoId: "memo-1",
		});

		expect(pageId).toBe("xdraft-page-1");
		expect(mockNotion.pages.create).toHaveBeenCalledOnce();
	});
});

describe("fetchApprovedDrafts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("承認済みドラフトを取得できる", async () => {
		mockNotion.databases.query.mockResolvedValue({
			results: [
				{
					id: "draft-1",
					object: "page",
					properties: {
						Title: {
							type: "title",
							title: [{ plain_text: "承認済み記事" }],
						},
						Platform: {
							type: "multi_select",
							multi_select: [{ name: "Zenn" }],
						},
						SourceMemo: {
							type: "relation",
							relation: [{ id: "memo-1" }],
						},
						Status: {
							type: "select",
							select: { name: "承認済み" },
						},
					},
				},
			],
			has_more: false,
			next_cursor: null,
			type: "page_or_database",
			page_or_database: {},
		} as never);

		mockNotion.blocks.children.list.mockResolvedValue({
			results: [
				{
					type: "paragraph",
					paragraph: {
						rich_text: [{ plain_text: "記事本文" }],
					},
				},
			],
			has_more: false,
			next_cursor: null,
			type: "block",
			block: {},
		} as never);

		const drafts = await fetchApprovedDrafts();

		expect(drafts).toHaveLength(1);
		expect(drafts[0].title).toBe("承認済み記事");
		expect(drafts[0].body).toBe("記事本文");
		expect(drafts[0].platforms).toEqual(["Zenn"]);
	});
});

describe("fetchApprovedXDrafts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("承認済みX投稿ドラフトを取得できる", async () => {
		mockNotion.databases.query.mockResolvedValue({
			results: [
				{
					id: "xdraft-1",
					object: "page",
					properties: {
						Title: {
							type: "title",
							title: [{ plain_text: "X投稿テスト" }],
						},
						XPost_1: {
							type: "rich_text",
							rich_text: [{ plain_text: "投稿1" }],
						},
						XPost_2: {
							type: "rich_text",
							rich_text: [{ plain_text: "投稿2" }],
						},
						XPost_3: {
							type: "rich_text",
							rich_text: [{ plain_text: "投稿3" }],
						},
						Status: {
							type: "select",
							select: { name: "承認済み" },
						},
						SourceMemo: {
							type: "relation",
							relation: [{ id: "memo-1" }],
						},
						ScheduledAt: {
							type: "date",
							date: null,
						},
					},
				},
			],
			has_more: false,
			next_cursor: null,
			type: "page_or_database",
			page_or_database: {},
		} as never);

		const xDrafts = await fetchApprovedXDrafts();

		expect(xDrafts).toHaveLength(1);
		expect(xDrafts[0].title).toBe("X投稿テスト");
		expect(xDrafts[0].xPost1).toBe("投稿1");
		expect(xDrafts[0].xPost2).toBe("投稿2");
		expect(xDrafts[0].xPost3).toBe("投稿3");
	});
});

describe("updateStatus", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("メモのステータスを更新できる", async () => {
		mockNotion.pages.update.mockResolvedValue({} as never);

		await updateMemoStatus("memo-1", "生成中");

		expect(mockNotion.pages.update).toHaveBeenCalledWith({
			page_id: "memo-1",
			properties: {
				Status: { select: { name: "生成中" } },
			},
		});
	});

	it("ドラフトのステータスを更新できる", async () => {
		mockNotion.pages.update.mockResolvedValue({} as never);

		await updateDraftStatus("draft-1", "投稿完了");

		expect(mockNotion.pages.update).toHaveBeenCalledWith({
			page_id: "draft-1",
			properties: {
				Status: { select: { name: "投稿完了" } },
			},
		});
	});

	it("X投稿ドラフトのステータスを更新できる", async () => {
		mockNotion.pages.update.mockResolvedValue({} as never);

		await updateXDraftStatus("xdraft-1", "投稿済み");

		expect(mockNotion.pages.update).toHaveBeenCalledWith({
			page_id: "xdraft-1",
			properties: {
				Status: { select: { name: "投稿済み" } },
			},
		});
	});
});
