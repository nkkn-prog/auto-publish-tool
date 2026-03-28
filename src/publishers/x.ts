import { createHmac, randomBytes } from "node:crypto";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { PublishResult } from "../notion/types.js";

const TWEET_API_URL = "https://api.x.com/2/tweets";

function percentEncode(str: string): string {
	return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateOAuthSignature(
	method: string,
	url: string,
	params: Record<string, string>,
	consumerSecret: string,
	tokenSecret: string,
): string {
	const sortedParams = Object.keys(params)
		.sort()
		.map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
		.join("&");

	const baseString = `${method}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
	const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

	return createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function buildOAuthHeader(text: string): string {
	const oauthParams: Record<string, string> = {
		oauth_consumer_key: config.x.apiKey,
		oauth_nonce: randomBytes(16).toString("hex"),
		oauth_signature_method: "HMAC-SHA1",
		oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
		oauth_token: config.x.accessToken,
		oauth_version: "1.0",
	};

	const signature = generateOAuthSignature(
		"POST",
		TWEET_API_URL,
		oauthParams,
		config.x.apiSecret,
		config.x.accessTokenSecret,
	);

	oauthParams.oauth_signature = signature;

	const headerString = Object.keys(oauthParams)
		.sort()
		.map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
		.join(", ");

	return `OAuth ${headerString}`;
}

export async function publishToX(text: string): Promise<PublishResult> {
	try {
		const authHeader = buildOAuthHeader(text);

		const response = await fetch(TWEET_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: authHeader,
			},
			body: JSON.stringify({ text }),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`X API error: ${response.status} ${errorBody}`);
		}

		const data = (await response.json()) as { data: { id: string } };
		const tweetUrl = `https://x.com/i/status/${data.data.id}`;

		logger.info(`Xに投稿しました: ${tweetUrl}`);
		return { platform: "X", success: true, url: tweetUrl };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error("Xへの投稿に失敗しました", error);
		return { platform: "X", success: false, error: message };
	}
}
