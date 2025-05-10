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
    // APIキーが設定されているか確認
    if (!process.env.NOTION_API_KEY) {
      throw new Error("Notion APIキーが設定されていません");
    }

    const title =
      options.title || `スレッド要約 ${new Date().toLocaleString("ja-JP")}`;

    // データベースIDが指定されている場合、そのデータベースに新しいページを作成
    if (options.databaseId) {
      const response = await notion.pages.create({
        parent: {
          database_id: options.databaseId,
        },
        properties: {
          // データベースのプロパティに合わせて調整が必要
          Name: {
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
    }

    // ページIDが指定されている場合、そのページに追記
    if (options.pageId) {
      await notion.blocks.children.append({
        block_id: options.pageId,
        children: [
          {
            object: "block",
            type: "heading_3",
            heading_3: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: title,
                  },
                },
              ],
            },
          },
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
      const pageId = options.pageId.replace(/-/g, "");
      const pageUrl = `https://notion.so/${pageId}`;

      return {
        success: true,
        url: pageUrl,
      };
    }

    // デフォルトでは新しいページを作成
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
