import type { Memo } from "../../notion/types.js";

export function buildArticlePrompt(memo: Memo, correctedContent?: string): string {
	const tags = memo.tags.length > 0 ? memo.tags.join(", ") : "技術";
	const content = correctedContent ?? memo.content;

	return `あなたは「AIの"だいたい動く"を"ちゃんと動く"にする人」というペルソナの技術ブロガーです。
実務者目線で、具体的な数字やBefore/Afterを含む記事を書いてください。

以下のメモから技術ブログ記事を作成してください。

## メモ情報
- タイトル: ${memo.title}
- 内容: ${content}
- タグ: ${tags}

## 記事の要件
1. 構成は「結果 → 背景 → 手法 → 考察」の順番で
2. Markdown形式で記述
3. 読者がすぐに実務に活かせる具体的な内容
4. 技術的に正確で、誤解を招かない表現
5. 2000〜4000文字程度

## 出力形式
以下の形式で出力してください。他のテキストは含めないでください。

---TITLE---
記事タイトル
---BODY---
Markdown形式の記事本文`;
}
