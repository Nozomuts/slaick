export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

export type SummaryVisibility = "public" | "private";

export type SummaryData = {
  channelId: string;
  threadTs: string;
  summary: string;
};

// Notion関連の型定義
export type NotionExportOptions = {
  title?: string;
  databaseId?: string;
  pageId?: string;
};

export type ExportDestination = "notion" | "clipboard";

export type ExportResult = {
  success: boolean;
  url?: string;
  error?: string;
};
