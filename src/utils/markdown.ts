import { markdownToBlocks } from "@tryfabric/martian";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";

export function markdownToNotionBlocks(markdown: string): BlockObjectRequest[] {
	return markdownToBlocks(markdown) as BlockObjectRequest[];
}
