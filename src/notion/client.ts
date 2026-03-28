import { Client } from "@notionhq/client";
import { config } from "../config.js";

export const notion = new Client({
	auth: config.notion.apiToken,
});
