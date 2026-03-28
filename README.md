# auto-publish-tool

業務メモを Notion に書くだけで、技術ブログ記事と SNS 投稿を自動生成・自動投稿するパイプライン。

人の手が入るのは **「ドラフトの確認・承認」の 1 箇所のみ**。

## パイプライン全体像

```
① Notionにメモを記載（手動・唯一の入力作業）
    ↓
② Notion APIでメモを取得（自動・GitHub Actions cron 5分間隔）
    ↓
③ Claude APIで記事ドラフト + X投稿文を同時生成（自動）
    ↓
④ ドラフトをNotionの別ページに保存（自動）
    ↓
⑤ Slack Webhookで通知（自動）
    ↓
⑥ ドラフト確認・修正（手動・スマホからNotionで確認）
    ↓
⑦ Notionのステータスを「承認済み」に変更（手動・ボタン1つ）
    ↓
⑧ ステータス変更を検知（自動・GitHub Actions cron 5分間隔）
    ↓
⑨ 各プラットフォームに自動投稿（自動）
   - Zenn: GitHub経由で公開
   - Qiita: API v2で投稿
   - X: 3パターンを時差投稿
   - note: Browser Use CLI 2.0（Sprint 4で実装予定）
```

## セットアップ

### 前提条件

- Node.js 20 以上
- pnpm

### 1. リポジトリをクローン

```bash
git clone https://github.com/your-org/auto-publish-tool.git
cd auto-publish-tool
```

### 2. 依存パッケージをインストール

```bash
pnpm install
```

### 3. 環境変数を設定

```bash
cp .env.example .env
```

`.env` を開き、各サービスの認証情報を記入する。

```env
# ===== Notion =====
NOTION_API_TOKEN=secret_xxx       # Notion Integration Token
NOTION_MEMO_DB_ID=xxx             # メモDBのID
NOTION_DRAFT_DB_ID=xxx            # 記事ドラフトDBのID
NOTION_XDRAFT_DB_ID=xxx           # X投稿ドラフトDBのID

# ===== Anthropic (Claude API) =====
ANTHROPIC_API_KEY=sk-ant-xxx

# ===== Slack =====
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx

# ===== X (Twitter) =====
X_API_KEY=xxx
X_API_SECRET=xxx
X_ACCESS_TOKEN=xxx
X_ACCESS_TOKEN_SECRET=xxx

# ===== Qiita =====
QIITA_ACCESS_TOKEN=xxx

# ===== Zenn (GitHub) =====
ZENN_REPO=username/zenn-content   # Zenn連携リポジトリ
GH_PAT=ghp_xxx                   # GitHub Personal Access Token（任意）

# ===== note (Browser Automation) =====
NOTE_EMAIL=                       # Sprint 4で使用
NOTE_PASSWORD=
NOTE_CHROME_PROFILE_PATH=
```

各キーの取得手順は `SETUP_CHECKLIST.md` を参照。

### 4. Notion データベースを準備

3 つのデータベースを作成し、Integration を接続する。

**メモ DB**

| プロパティ | 型 | 値 |
|-----------|------|------|
| Title | タイトル | メモのタイトル |
| Content | リッチテキスト | メモ本文 |
| Tags | マルチセレクト | `Claude`, `AI開発` など |
| Status | セレクト | `未処理`, `生成中`, `生成完了` |

**draft DB（記事用ドラフト）**

| プロパティ | 型 | 値 |
|-----------|------|------|
| Title | タイトル | 記事タイトル（AI 生成） |
| Status | セレクト | `レビュー待ち`, `承認済み`, `投稿中`, `投稿完了`, `投稿失敗` |
| SourceMemo | リレーション | メモ DB へのリレーション |
| Platform | マルチセレクト | `Zenn`, `Qiita`, `note` |

記事本文はページ本文（ボディ）に Markdown として書き込まれる。

**xdraft DB（X 投稿用ドラフト）**

| プロパティ | 型 | 値 |
|-----------|------|------|
| Title | タイトル | 識別用タイトル |
| XPost_1 | リッチテキスト | X 投稿文パターン 1 |
| XPost_2 | リッチテキスト | X 投稿文パターン 2 |
| XPost_3 | リッチテキスト | X 投稿文パターン 3 |
| Status | セレクト | `未承認`, `承認済み`, `投稿済み` |
| SourceMemo | リレーション | メモ DB へのリレーション |
| ScheduledAt | 日付 | 予約投稿日時 |

各 DB の Status プロパティでカンバンビューを作ると、進捗がひと目で分かる。

## 使い方

### Step 1: メモを書く

Notion のメモ DB に新規ページを作成し、タイトル・本文・タグを記入する。
Status は `未処理` にしておく（デフォルト）。

### Step 2: ドラフトを自動生成

```bash
pnpm generate-draft
```

実行すると以下が自動的に行われる：

1. メモ DB から `未処理` のメモを取得
2. Claude API（claude-sonnet-4-6）で記事ドラフトと X 投稿文 3 パターンを並行生成
3. draft DB にドラフトを保存（ステータス: `レビュー待ち`）
4. xdraft DB に X 投稿文を保存（ステータス: `未承認`）
5. Slack にドラフトの Notion リンク付き通知を送信

失敗時は 3 回まで自動リトライ（指数バックオフ）する。

### Step 3: ドラフトを確認・承認

Slack 通知のリンクから Notion を開き、ドラフトを確認する。
必要に応じて修正した後：

- **記事ドラフト**: Status を `承認済み` に変更
- **X 投稿ドラフト**: Status を `承認済み` に変更

### Step 4: 承認済みコンテンツを自動投稿

```bash
pnpm publish-approved
```

実行すると以下が自動的に行われる：

- **記事**: draft DB から `承認済み` のドラフトを取得し、指定プラットフォーム（Zenn / Qiita / note）に並行投稿
- **X 投稿**: xdraft DB から `承認済み` のドラフトを取得し、3 パターンを 1 分間隔で時差投稿

投稿後、Notion のステータスが `投稿完了` または `投稿済み` に更新され、Slack に結果が通知される。

## GitHub Actions による自動化

手動でコマンドを実行する代わりに、GitHub Actions の cron で 5 分間隔に自動実行できる。

| ワークフロー | トリガー | 処理内容 |
|-------------|---------|---------|
| `generate-draft.yml` | 5 分ごと / 手動 | メモ検知 → ドラフト生成 → 通知 |
| `publish-approved.yml` | 5 分ごと / 手動 | 承認検知 → 各プラットフォーム投稿 |

有効化するには、リポジトリの Settings > Secrets and variables > Actions に全環境変数を登録する。
登録が必要な Secret の一覧は `SETUP_CHECKLIST.md` のセクション 8 を参照。

ワークフローは `workflow_dispatch` にも対応しているため、Actions タブから手動実行も可能。

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `pnpm generate-draft` | 未処理メモからドラフトを生成 |
| `pnpm publish-approved` | 承認済みドラフトを各プラットフォームに投稿 |
| `pnpm test` | テストを実行 |
| `pnpm test:watch` | テストをウォッチモードで実行 |
| `pnpm build` | TypeScript をビルド |
| `pnpm lint` | Biome でリント |
| `pnpm lint:fix` | リント + 自動修正 |
| `pnpm format` | コードフォーマット |

## 投稿先プラットフォーム

| プラットフォーム | 方式 | 状態 |
|----------------|------|------|
| Zenn | Markdown ファイルを GitHub リポジトリに Push | 実装済み |
| Qiita | API v2 (`POST /api/v2/items`) | 実装済み |
| X (Twitter) | OAuth 1.0a + Tweet API v2 | 実装済み |
| note | Browser Use CLI 2.0 / Playwright | Sprint 4 で実装予定 |

## プロジェクト構成

```
auto-publish-tool/
├── .github/workflows/
│   ├── generate-draft.yml        # ドラフト生成ワークフロー
│   └── publish-approved.yml      # 自動投稿ワークフロー
├── src/
│   ├── commands/
│   │   ├── generateDraft.ts      # ドラフト生成パイプライン
│   │   └── publishApproved.ts    # 承認済み投稿パイプライン
│   ├── ai/
│   │   ├── generateDraft.ts      # Claude API 記事生成
│   │   ├── generateXPosts.ts     # Claude API X投稿文生成
│   │   └── prompts/              # プロンプトテンプレート
│   ├── notion/
│   │   ├── client.ts             # Notion API クライアント
│   │   ├── types.ts              # 型定義
│   │   ├── fetchMemos.ts         # 未処理メモ取得
│   │   ├── saveDraft.ts          # ドラフト保存
│   │   ├── saveXDraft.ts         # X投稿ドラフト保存
│   │   ├── fetchApprovedDrafts.ts
│   │   ├── fetchApprovedXDrafts.ts
│   │   └── updateStatus.ts       # ステータス更新
│   ├── publishers/
│   │   ├── zenn.ts               # Zenn投稿
│   │   ├── qiita.ts              # Qiita投稿
│   │   ├── x.ts                  # X投稿
│   │   └── note.ts               # note投稿（未実装）
│   ├── notifications/
│   │   └── slack.ts              # Slack通知
│   └── utils/
│       ├── logger.ts             # ログ出力
│       └── markdown.ts           # Markdown変換
├── tests/                        # Vitest テスト
├── zenn/articles/                # Zenn記事出力先
├── .env.example
├── biome.json
├── tsconfig.json
└── vitest.config.ts
```

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript (Node.js) |
| AI 生成 | Claude API (Anthropic SDK) |
| データストア | Notion Database |
| 実行環境 | GitHub Actions (cron) |
| 通知 | Slack Incoming Webhook |
| テスト | Vitest |
| リンター | Biome |
| パッケージ管理 | pnpm |

## ライセンス

Private
