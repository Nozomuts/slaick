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
