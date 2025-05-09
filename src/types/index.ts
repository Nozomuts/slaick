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
