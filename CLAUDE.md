# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Notionに書いた業務メモから、Claude APIでブログ記事とSNS投稿文を自動生成し、複数プラットフォーム（Zenn, Qiita, X, note）に自動投稿するパイプライン。人の手が入るのは「Notionでドラフトを確認・承認する」1箇所のみ。

## コマンド

```bash
pnpm install              # 依存パッケージのインストール
pnpm build                # TypeScriptビルド (tsc → dist/)
pnpm dev                  # src/index.ts を tsx で実行
pnpm generate-draft       # 生成パイプライン: 未処理メモ取得 → ドラフト生成 → Notion保存 → Slack通知
pnpm publish-approved     # 投稿パイプライン: 承認済みドラフト取得 → 各プラットフォーム投稿 → ステータス更新
pnpm test                 # テスト実行 (vitest)
pnpm test:watch           # テストをウォッチモードで実行
vitest run tests/ai.test.ts  # 単一テストファイルの実行
pnpm lint                 # Biome リントチェック
pnpm lint:fix             # Biome リント + 自動修正
pnpm format               # Biome フォーマット
```

## アーキテクチャ

2つのメインパイプラインがあり、ローカル実行またはGitHub Actions cron（5分間隔）で動作する。

**生成パイプライン** (`src/commands/generateDraft.ts`):
Notionメモ（Status: 未処理）→ Claude APIで記事ドラフトとX投稿文3パターンを並行生成 → Notionのdraft/xdraft DBに保存 → Slack通知。失敗時は指数バックオフで最大3回リトライ。

**投稿パイプライン** (`src/commands/publishApproved.ts`):
Notionドラフト（Status: 承認済み）→ 各プラットフォームに並行投稿（Zenn: GitHub push、Qiita: API、X: OAuth）→ Notionステータス更新 → Slack通知。X投稿は1分間隔で時差投稿。

**主要レイヤー:**
- `src/ai/` - Claude API連携。プロンプトテンプレートは `src/ai/prompts/` に配置
- `src/notion/` - Notion API操作（取得・保存・ステータス更新）。`types.ts` に3つのDB（Memo, Draft, XDraft）の型定義
- `src/publishers/` - プラットフォーム別の投稿処理（zenn, qiita, x, note）。noteは未実装
- `src/notifications/` - Slack Webhook通知
- `src/config.ts` - 環境変数の一元管理（`requireEnv`/`optionalEnv`ヘルパー）
- `src/index.ts` - notionモジュールの再エクスポート（ライブラリエントリポイント）

## コードスタイル

- **Biome** でリント・フォーマット: インデントはタブ、行幅100文字
- ESM（`"type": "module"`）— インポートは `.js` 拡張子付き
- TypeScript strict モード、ターゲット ES2022
- ログメッセージ、Notionステータス、プロンプトテンプレートは日本語
- Claude APIモデル: `claude-sonnet-4-6-20250514`
