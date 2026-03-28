import type { Memo } from "../../notion/types.js";

export function buildXPostPrompt(memo: Memo): string {
	const tags = memo.tags.length > 0 ? memo.tags.join(", ") : "技術";

	return `あなたはAI・技術系の発信者です。以下のメモから、X（旧Twitter）の投稿文を3パターン作成してください。

## メモ情報
- タイトル: ${memo.title}
- 内容: ${memo.content}
- タグ: ${tags}

## 投稿文の要件
1. 各投稿は140文字以内
2. パターン1: 問いかけ型（読者に考えさせる問いで始める）
3. パターン2: 数字型（具体的な数字・データで始める）
4. パターン3: ストーリー型（体験談・エピソードで始める）
5. ハッシュタグは各投稿に1〜2個
6. 専門用語は噛み砕いて説明

## 出力形式
以下のJSON形式で出力してください。他のテキストは含めないでください。

\`\`\`json
{
  "xPost1": "投稿文パターン1",
  "xPost2": "投稿文パターン2",
  "xPost3": "投稿文パターン3"
}
\`\`\``;
}
