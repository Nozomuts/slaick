import { Client } from "@notionhq/client";
import { ExportResult, NotionExportOptions } from "../types";

// Notionクライアントの初期化
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

/**
 * スレッド要約をNotionにエクスポートする
 */
export const exportToNotion = async (
  summary: string,
  options: NotionExportOptions = {}
): Promise<ExportResult> => {
  try {
    if (!process.env.NOTION_API_KEY) {
      throw new Error("Notion APIキーが設定されていません");
    }

    const title =
      options.title || `Slack要約 ${new Date().toLocaleString("ja-JP")}`;

    const response = await notion.pages.create({
      parent: {
        type: "page_id",
        page_id: process.env.NOTION_DEFAULT_PAGE_ID || "",
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: summary,
                },
              },
            ],
          },
        },
      ],
    });

    // ページIDからURLを構築
    const pageId = response.id.replace(/-/g, "");
    const pageUrl = `https://notion.so/${pageId}`;

    return {
      success: true,
      url: pageUrl,
    };
  } catch (error) {
    console.error("Notionエクスポートエラー:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Notionへのエクスポート中にエラーが発生しました",
    };
  }
};
