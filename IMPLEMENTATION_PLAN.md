# 発信自動化パイプライン — 実装計画書

> プロジェクト名: auto-publish-tool
> 作成日: 2026-03-24
> 作成者: Naoki

---

## 1. プロジェクト概要

### 1.1 目的

業務メモをNotionに書くだけで、技術ブログ記事とSNS投稿を自動生成・自動投稿するパイプラインを構築する。人の手が入るのは「ドラフトの確認・承認」の1箇所のみ。

### 1.2 ビジョン

自分の発信活動自体をAIで仕組み化し、その過程を発信ネタにする。将来的にはマーケティング自動化ツールとしてプロダクト化し、個人開発者や発信者向けに販売する。

### 1.3 パイプライン全体像

```
① Notionにメモを記載（手動・唯一の入力作業）
    ↓
② Notion APIでメモを取得（自動・GitHub Actions cron）
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
⑧ ステータス変更を検知（自動・GitHub Actions cron）
    ↓
⑨ 各プラットフォームに自動投稿（自動）
   - Zenn: GitHub経由で公開
   - Qiita: API v2で投稿
   - X: API予約投稿
   - note: Browser Use CLI 2.0（フォールバック: Playwright）
```

---

## 2. 技術構成

### 2.1 技術スタック

| カテゴリ | 技術 | 理由 |
|---------|------|------|
| 言語 | TypeScript (Node.js) | 型安全、Notion SDK・各種APIクライアントが充実 |
| データストア | Notion Database | 将来プロダクト化時に差し替え可能、カンバンビューがダッシュボード代わり |
| AI生成 | Claude API (Anthropic SDK) | 記事ドラフト + X投稿文を同時生成 |
| 実行環境 | GitHub Actions (schedule cron) | 無料枠2,000分/月で十分、即時性は不要 |
| 通知 | Slack Incoming Webhook | スマホ・PC両対応、無料 |
| note投稿 | Browser Use CLI 2.0 / Playwright | 公式APIなしのため、ブラウザ自動化で対応 |
| パッケージ管理 | pnpm | 高速、ディスク効率が良い |
| テスト | Vitest | 高速、TypeScriptネイティブサポート |
| リンター | Biome | ESLint + Prettierの代替、高速 |

### 2.2 外部サービス・API

| サービス | 用途 | 認証方法 | 費用 |
|---------|------|---------|------|
| Notion API | メモ取得・ドラフト保存 | Integration Token | 無料 |
| Claude API (Anthropic) | 記事・投稿文生成 | API Key | 従量課金 |
| Slack Incoming Webhook | 通知 | Webhook URL | 無料 |
| X API (Free Plan) | ツイート投稿 | OAuth 2.0 | 無料（月500投稿まで） |
| Qiita API v2 | 記事投稿 | Access Token | 無料（1,000回/時間） |
| Zenn (GitHub連携) | 記事公開 | GitHub Push | 無料 |
| note | 記事投稿 | ブラウザ自動化（ログインセッション） | 無料 |

---

## 3. ディレクトリ構成

```
auto-publish-tool/
├── .github/
│   └── workflows/
│       ├── generate-draft.yml    # ②③④⑤: メモ検知 → 生成 → 保存 → 通知
│       └── publish-approved.yml  # ⑧⑨: 承認検知 → 各プラットフォーム投稿
├── src/
│   ├── index.ts                  # エントリーポイント
│   ├── config.ts                 # 環境変数・設定管理
│   ├── notion/
│   │   ├── client.ts             # Notion API クライアント
│   │   ├── fetchMemos.ts         # ステータス「未処理」のメモを取得
│   │   ├── saveDraft.ts          # 記事ドラフトをdraft DBに保存
│   │   ├── saveXDraft.ts         # X投稿文をxdraft DBに保存
│   │   ├── fetchApprovedDrafts.ts    # draft DBからステータス「承認済み」を取得
│   │   ├── fetchApprovedXDrafts.ts   # xdraft DBからステータス「承認済み」を取得
│   │   ├── updateStatus.ts       # ステータス更新（投稿完了等）
│   │   └── types.ts              # Notion DB スキーマの型定義
│   ├── ai/
│   │   ├── generateDraft.ts      # Claude API で記事ドラフト生成
│   │   ├── generateXPosts.ts     # Claude API で X投稿文生成
│   │   └── prompts/
│   │       ├── articlePrompt.ts  # 記事生成用プロンプトテンプレート
│   │       └── xPostPrompt.ts   # X投稿文生成用プロンプトテンプレート
│   ├── publishers/
│   │   ├── zenn.ts               # Zenn公開（GitHub Push）
│   │   ├── qiita.ts              # Qiita API v2 投稿
│   │   ├── x.ts                  # X API 投稿
│   │   └── note.ts               # note投稿（Browser Use CLI 2.0 / Playwright）
│   ├── notifications/
│   │   └── slack.ts              # Slack Webhook 通知
│   └── utils/
│       ├── logger.ts             # ログ出力
│       └── markdown.ts           # Markdown変換ユーティリティ
├── zenn/                          # Zenn CLI用コンテンツディレクトリ
│   └── articles/                  # 自動生成される記事Markdownファイル
├── tests/
│   ├── notion.test.ts
│   ├── ai.test.ts
│   ├── publishers.test.ts
│   └── notifications.test.ts
├── .env.example                   # 環境変数テンプレート
├── .gitignore
├── package.json
├── tsconfig.json
├── biome.json
├── vitest.config.ts
└── README.md
```

---

## 4. Notionデータベース設計

### 4.1 メモDB（インプット）

| プロパティ名 | 型 | 説明 |
|-------------|---|------|
| Title | タイトル | メモのタイトル（トピック名） |
| Content | リッチテキスト | メモ本文（業務の気づき・学び） |
| Tags | マルチセレクト | カテゴリタグ（Claude, AI開発, チューニング等） |
| Status | セレクト | `未処理` → `生成中` → `生成完了` |
| CreatedAt | 作成日時 | 自動 |

### 4.2 draft DB（記事用ドラフト）

| プロパティ名 | 型 | 説明 |
|-------------|---|------|
| Title | タイトル | 記事タイトル（AI生成） |
| Status | セレクト | `レビュー待ち` → `承認済み` → `投稿中` → `投稿完了` → `投稿失敗` |
| SourceMemo | リレーション | 元メモDBへのリレーション |
| Platform | マルチセレクト | 投稿先プラットフォーム（`Zenn`, `Qiita`, `note`） |

**ページ本文（ボディ）：**

記事本文（Markdown）は Notion API の `children` ブロックとしてページ本文に書き込む。プロパティではなくページを開いた際の本文エリアに記事全文が表示される。レビュー時にそのまま読める。

> ※ 記事本文をプロパティ（リッチテキスト）に格納しない理由：Notionのリッチテキストプロパティは長文Markdownに不向き（文字数制限あり、Markdown表示非対応）。

### 4.3 xdraft DB（X投稿用ドラフト）

| プロパティ名 | 型 | 説明 |
|-------------|---|------|
| Title | タイトル | 投稿の識別用タイトル |
| XPost_1 | リッチテキスト | X投稿文パターン1（AI生成） |
| XPost_2 | リッチテキスト | X投稿文パターン2（AI生成） |
| XPost_3 | リッチテキスト | X投稿文パターン3（AI生成） |
| Status | セレクト | `未承認` → `承認済み` → `投稿済み` |
| SourceMemo | リレーション | 元メモDBへのリレーション |
| ScheduledAt | 日付 | 予約投稿日時（時差投稿に使用） |

> ※ draft DBとxdraft DBを分離する理由：記事（数千文字のMarkdown）とX投稿文（140文字の短文）は性質・レビューの粒度・投稿タイミングが異なるため、ライフサイクルを独立管理する。

### 4.4 Notionカンバンビュー設定

**draft DB（記事用）：**
```
| レビュー待ち | 承認済み | 投稿中 | 投稿完了 | 投稿失敗 |
|------------|---------|--------|---------|---------|
| 記事A      | 記事C   |        | 記事X   |         |
| 記事B      |         |        | 記事Y   |         |
```

**xdraft DB（X投稿用）：**
```
| 未承認      | 承認済み | 投稿済み |
|------------|---------|---------|
| 投稿文A     | 投稿文C |  投稿文X |
| 投稿文B     |         |  投稿文Y |
```

---

## 5. GitHub Actions ワークフロー設計

### 5.1 generate-draft.yml（メモ検知 → ドラフト生成）

```yaml
# 実行タイミング: 5分ごと
# 処理フロー:
#   1. Notion APIで「未処理」ステータスのメモを取得
#   2. メモが存在しなければ終了
#   3. メモのステータスを「生成中」に更新
#   4. Claude APIで記事ドラフト + X投稿文を生成
#   5. ドラフトDBに保存（ステータス: レビュー待ち）
#   6. メモのステータスを「生成完了」に更新
#   7. Slack Webhookで通知（Notionドラフトページへのリンク付き）
#
# エラーハンドリング:
#   - Claude API失敗 → リトライ3回 → 失敗通知をSlackに送信
#   - Notion API失敗 → リトライ3回 → 失敗通知をSlackに送信
#
# cron: '*/5 * * * *'（5分間隔）
# ※ GitHub Actionsのcronは数分のズレが発生する場合がある
```

### 5.2 publish-approved.yml（承認検知 → 自動投稿）

```yaml
# 実行タイミング: 5分ごと
# 処理フロー:
#   1. Notion APIで「承認済み」ステータスのドラフトを取得
#   2. ドラフトが存在しなければ終了
#   3. ステータスを「投稿中」に更新
#   4. 各プラットフォームに並行投稿:
#      a. Zenn: Markdownファイルを生成 → GitHubリポジトリにPush
#      b. Qiita: API v2で記事を投稿
#      c. X: APIで投稿（X投稿文パターンから選択 or 全パターン時差投稿）
#      d. note: Browser Use CLI 2.0でブラウザ投稿（失敗時: Playwright）
#   5. 各プラットフォームの公開URLをドラフトDBに記録
#   6. 全て成功 → ステータスを「投稿完了」に更新
#   7. 一部失敗 → ステータスを「投稿失敗」に更新 + Slack通知
#
# エラーハンドリング:
#   - 各プラットフォームは独立して投稿（1つの失敗が他に影響しない）
#   - 失敗したプラットフォームのみSlackで通知
#
# cron: '*/5 * * * *'（5分間隔）
```

---

## 6. 主要モジュール詳細設計

### 6.1 src/notion/fetchMemos.ts

```
入力: なし
出力: Memo[]（ステータスが「未処理」のメモ一覧）
処理:
  1. Notion APIでメモDBをクエリ（filter: Status = "未処理"）
  2. 結果をMemo型にマッピング
  3. 空配列の場合はログ出力して早期リターン
```

### 6.2 src/ai/generateDraft.ts

```
入力: Memo（メモオブジェクト）
出力: Draft（記事本文 + X投稿文3パターン）
処理:
  1. メモの内容からプロンプトを構築
  2. Claude API（claude-sonnet-4-6）にリクエスト
  3. レスポンスをパース:
     - 記事タイトル
     - 記事本文（Markdown）→ Notionページ本文（children blocks）として保存
     - X投稿文 × 3パターン → プロパティとして保存
  4. Draft型にマッピングして返却

プロンプト設計方針:
  - ペルソナ: 「AIの"だいたい動く"を"ちゃんと動く"にする人」
  - トーン: 実務者目線、具体的な数字やBefore/Afterを含む
  - 記事構成: 結果 → 背景 → 手法 → 考察
  - X投稿文: 140文字以内、1つは問いかけ型、1つは数字型、1つはストーリー型
```

### 6.2.1 src/notion/saveDraft.ts（補足）

```
記事本文の保存方法:
  1. Notion APIでドラフトDBに新規ページを作成（プロパティ: Title, XPost_1〜3, Status等）
  2. 作成したページのIDを取得
  3. Notion API の blocks.children.append() で記事本文をページ本文に追加
     - Markdownをparagraph, heading, code, bulleted_list_item等のブロックに変換
     - @tryfabric/martian 等のMarkdown→Notionブロック変換ライブラリを活用
```

### 6.3 src/publishers/zenn.ts

```
入力: Draft（承認済みドラフト）
出力: PublishResult（公開URL or エラー）
処理:
  1. Markdownファイルを zenn/articles/ に生成
     - ファイル名: YYYYMMDD-{slug}.md
     - Front Matter: title, emoji, type, topics, published
  2. git add → git commit → git push
  3. Zennが自動デプロイ → 公開URLを取得
```

### 6.4 src/publishers/qiita.ts

```
入力: Draft（承認済みドラフト）
出力: PublishResult（公開URL or エラー）
処理:
  1. Qiita API v2にPOST /api/v2/items
  2. リクエストボディ: title, body(Markdown), tags, private(false)
  3. レスポンスからURLを取得
```

### 6.5 src/publishers/x.ts

```
入力: XPost（X投稿文）
出力: PublishResult（ツイートURL or エラー）
処理:
  1. OAuth 2.0でアクセストークン取得
  2. POST /2/tweets にテキストを送信
  3. レスポンスからツイートIDを取得 → URLを構築

オプション:
  - 3パターンを時差投稿（1時間間隔等）する場合は
    GitHub Actionsの別ワークフローでスケジュール管理
```

### 6.6 src/publishers/note.ts

```
入力: Draft（承認済みドラフト）
出力: PublishResult（公開URL or エラー）
処理（Browser Use CLI 2.0）:
  1. Chromeプロファイルでnoteにログイン状態を復元
  2. 新規記事作成ページに遷移
  3. タイトル入力 → 本文をペースト → 公開ボタンクリック
  4. 公開後のURLを取得

フォールバック（Playwright）:
  1. Playwrightでヘッドレスブラウザを起動
  2. noteにログイン（Cookie保持）
  3. 同様の操作を実行

注意事項:
  - GitHub Actions上ではヘッドレスモードが必須
  - ログインセッションの管理方法を検討（暗号化Cookie等）
  - note利用規約の確認が必要
```

### 6.7 src/notifications/slack.ts

```
入力: NotificationPayload（メッセージ内容 + ドラフトURL）
出力: void
処理:
  1. Slack Incoming Webhook URLにPOST
  2. ペイロード:
     - テキスト: 「新しいドラフトが生成されました」
     - ドラフトのタイトル
     - Notionページへのリンクボタン
     - 元メモのタグ情報
```

---

## 7. 環境変数

```env
# Notion
NOTION_API_TOKEN=secret_xxx
NOTION_MEMO_DB_ID=xxx
NOTION_DRAFT_DB_ID=xxx
NOTION_XDRAFT_DB_ID=xxx

# Anthropic (Claude API)
ANTHROPIC_API_KEY=sk-ant-xxx

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx

# X (Twitter)
X_API_KEY=xxx
X_API_SECRET=xxx
X_ACCESS_TOKEN=xxx
X_ACCESS_TOKEN_SECRET=xxx

# Qiita
QIITA_ACCESS_TOKEN=xxx

# Zenn (GitHub Push用)
# GitHub Actionsのデフォルトトークン (GITHUB_TOKEN) を使用
# 別リポジトリにPushする場合はPATが必要
ZENN_REPO=naoki/zenn-content

# note (Browser Automation)
NOTE_EMAIL=nkkn.prog@gmail.com
NOTE_PASSWORD=xxx  # ※ 暗号化して管理
```

---

## 8. 実装スケジュール

### Sprint 1: 基盤構築（Week 1）
目標: プロジェクトのセットアップとNotionの読み書き

| タスク | 見積もり | 詳細 |
|--------|---------|------|
| リポジトリ初期化 | 1h | package.json, tsconfig, biome, vitest |
| Notionデータベース作成 | 1h | メモDB + ドラフトDB + カンバンビュー |
| Notion APIクライアント実装 | 3h | fetchMemos, saveDraft, fetchApproved, updateStatus |
| Notionモジュールのテスト | 2h | Vitest + モック |
| **合計** | **7h** | |

### Sprint 2: AI生成パイプライン（Week 2）
目標: メモからドラフトを自動生成

| タスク | 見積もり | 詳細 |
|--------|---------|------|
| Claude API連携実装 | 2h | Anthropic SDK |
| プロンプト設計・調整 | 3h | 記事生成 + X投稿文生成のプロンプト |
| ドラフト保存 → Slack通知 | 2h | Notion書き戻し + Webhook |
| generate-draft.yml 作成 | 2h | GitHub Actions ワークフロー |
| E2Eテスト（メモ → ドラフト） | 1h | 実際にNotionに書いて動作確認 |
| **合計** | **10h** | |

### Sprint 3: 自動投稿（Week 3）
目標: 承認後の自動投稿を実装

| タスク | 見積もり | 詳細 |
|--------|---------|------|
| Zenn投稿モジュール | 2h | zenn-cli設定 + GitHub Push |
| Qiita投稿モジュール | 2h | API v2連携 |
| X投稿モジュール | 3h | OAuth 2.0 + Tweet API |
| publish-approved.yml 作成 | 2h | GitHub Actions ワークフロー |
| E2Eテスト（承認 → 投稿） | 2h | 各プラットフォームへのテスト投稿 |
| **合計** | **11h** | |

### Sprint 4: note対応 + 安定化（Week 4）
目標: note自動投稿の実装と全体の安定化

| タスク | 見積もり | 詳細 |
|--------|---------|------|
| note投稿モジュール（Browser Use CLI 2.0） | 4h | ブラウザ自動化 + セッション管理 |
| Playwrightフォールバック実装 | 3h | ヘッドレスブラウザ対応 |
| エラーハンドリング強化 | 2h | リトライ、失敗通知、ロギング |
| README作成 | 1h | セットアップ手順 |
| 全体E2Eテスト | 2h | メモ → 全プラットフォーム投稿の通しテスト |
| **合計** | **12h** | |

### 合計見積もり

| Sprint | 工数 | 期間（週10h想定） |
|--------|------|-----------------|
| Sprint 1: 基盤構築 | 7h | Week 1 |
| Sprint 2: AI生成 | 10h | Week 2 |
| Sprint 3: 自動投稿 | 11h | Week 3 |
| Sprint 4: note + 安定化 | 12h | Week 4 |
| **合計** | **40h** | **約4週間** |

※ 月40時間の空き時間を全てこのプロジェクトに投下した場合、約1ヶ月で完成

---

## 9. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| GitHub Actions cronのズレ（数分） | 低 | 即時性は不要なため許容 |
| Claude APIのレート制限 | 低 | 1回の実行で1〜2メモしか処理しないため十分 |
| note利用規約違反 | 中 | 利用規約を確認、過度な自動化は避ける、手動投稿にフォールバック |
| noteのUI変更でブラウザ自動化が壊れる | 高 | Playwrightをフォールバックとして実装、手動コピペも最終手段として残す |
| GitHub Actions無料枠の超過 | 低 | 5分間隔 × 2ワークフロー ≒ 月580分、無料枠2,000分の範囲内 |
| Notionの同時更新による競合 | 低 | ステータスの遷移を厳密に管理（楽観ロック的アプローチ） |
| 生成されたドラフトの品質のばらつき | 中 | プロンプトの継続的改善、レビューステップで品質担保 |

---

## 10. 将来の拡張（フェーズ2・3）

### フェーズ2: 動画コンテンツの自動化

- 記事から動画台本を自動生成（Claude API）
- スライド自動作成（python-pptx）
- 音声合成（VOICEVOX / StyleBertVITS2）
- FFmpegで結合して動画化
- YouTube APIで自動アップロード

### フェーズ3: プロダクト化

- Notion依存から独自UIに移行
- マルチユーザー対応
- レビュー画面 + 承認ワークフロー
- SaaSとして月額課金モデル
- ターゲット: 個人開発者、発信者、中小企業

---

## 11. Naokiが手動で準備するもの（事前セットアップ）

### 11.1 アカウント・APIキー取得

| # | タスク | 手順の概要 | 所要時間目安 |
|---|--------|-----------|------------|
| 1 | Notion Integrationの作成 | notion.so/my-integrations → 新規作成 → トークンコピー | 5分 |
| 2 | Notionデータベース2つ作成 | メモDB + ドラフトDB（プロパティは4.1, 4.2参照） | 15分 |
| 3 | NotionDBにIntegrationを接続 | 各DBの「接続」からIntegrationを追加 | 2分 |
| 4 | Anthropic APIキー取得 | console.anthropic.com → APIキー発行 | 5分 |
| 5 | Slack Workspace + Incoming Webhook設定 | api.slack.com → App作成 → Incoming Webhook有効化 | 10分 |
| 6 | X Developer Portal登録 | developer.x.com → App作成 → OAuth 2.0設定 → キー取得 | 15分 |
| 7 | Qiitaアクセストークン発行 | qiita.com → 設定 → アプリケーション → 新規トークン | 3分 |
| 8 | Zenn用GitHubリポジトリ作成 | zenn.dev → GitHubリポジトリ連携 → zenn-cli初期化 | 10分 |
| 9 | GitHubリポジトリにSecrets登録 | Settings → Secrets → 全APIキーを登録 | 10分 |
| 10 | note ログイン情報の準備 | Browser Use CLI 2.0用のChromeプロファイル設定 | 10分 |

**合計: 約85分（1.5時間）**

### 11.2 セットアップ後の確認

- [ ] Notion APIでメモDBの読み取りが可能か確認
- [ ] Claude APIでテキスト生成が可能か確認
- [ ] Slackに通知が届くか確認
- [ ] Qiita APIでテスト記事（private）が投稿できるか確認
- [ ] X APIでテストツイートが投稿できるか確認
- [ ] Zenn用リポジトリにpushして記事が公開されるか確認

---

## 12. 参考リソース

- [Notion API公式ドキュメント](https://developers.notion.com/)
- [Anthropic Claude API公式ドキュメント](https://docs.anthropic.com/)
- [X API v2 公式ドキュメント](https://developer.x.com/en/docs/x-api)
- [Qiita API v2 公式ドキュメント](https://qiita.com/api/v2/docs)
- [Zenn CLI公式ガイド](https://zenn.dev/zenn/articles/zenn-cli-guide)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Browser Use CLI 2.0 × Claude Code ガイド](https://zenn.dev/7788/articles/cb88f98c576ef7)
- [Browser Use CLI × note自動投稿の実装例](https://note.com/st_dev0/n/n82ecfec6c359)
- [4プラットフォーム同時投稿CLI](https://zenn.dev/secure_auto_lab/articles/multi-platform-article-publisher)
- [Playwright公式ドキュメント](https://playwright.dev/)
