import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { NotificationPayload } from "../notion/types.js";

export async function sendSlackNotification(payload: NotificationPayload): Promise<void> {
	const blocks: unknown[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: payload.title,
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: payload.message,
			},
		},
	];

	if (payload.notionUrl) {
		blocks.push({
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "Notionで確認する",
					},
					url: payload.notionUrl,
					style: "primary",
				},
			],
		});
	}

	if (payload.tags && payload.tags.length > 0) {
		blocks.push({
			type: "context",
			elements: [
				{
					type: "mrkdwn",
					text: `タグ: ${payload.tags.join(", ")}`,
				},
			],
		});
	}

	const response = await fetch(config.slack.webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ blocks }),
	});

	if (!response.ok) {
		throw new Error(`Slack通知の送信に失敗しました: ${response.status} ${response.statusText}`);
	}

	logger.info("Slack通知を送信しました");
}
