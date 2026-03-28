// ===== メモDB =====
export type MemoStatus = "未処理" | "生成中" | "完了";

export interface Memo {
	id: string;
	title: string;
	content: string;
	tags: string[];
	status: MemoStatus;
	createdAt: string;
}

// ===== draft DB（記事用ドラフト） =====
export type DraftStatus = "レビュー待ち" | "承認済み" | "投稿中" | "投稿完了" | "投稿失敗";
export type Platform = "Zenn" | "Qiita" | "note";

export interface Draft {
	id: string;
	title: string;
	body: string;
	status: DraftStatus;
	sourceMemoId: string;
	platforms: Platform[];
}

export interface DraftInput {
	title: string;
	body: string;
	sourceMemoId: string;
	platforms: Platform[];
}

// ===== xdraft DB（X投稿用ドラフト） =====
export type XDraftStatus = "未承認" | "承認済み" | "投稿済み";

export interface XDraft {
	id: string;
	title: string;
	xPost1: string;
	xPost2: string;
	xPost3: string;
	status: XDraftStatus;
	sourceMemoId: string;
	scheduledAt: string | null;
}

export interface XDraftInput {
	title: string;
	xPost1: string;
	xPost2: string;
	xPost3: string;
	sourceMemoId: string;
}

// ===== 投稿結果 =====
export interface PublishResult {
	platform: string;
	success: boolean;
	url?: string;
	error?: string;
}

// ===== Slack通知 =====
export interface NotificationPayload {
	title: string;
	message: string;
	notionUrl?: string;
	tags?: string[];
}
