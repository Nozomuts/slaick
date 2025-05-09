import axios from "axios";
import { Message, OpenRouterResponse } from "../types";

export const summarizeThread = async (threadText: string): Promise<string> => {
  try {
    const messages: Message[] = [
      {
        role: "system",
        content:
          "あなたは与えられたSlackのスレッド会話を読み取り、その内容を要約するアシスタントです。",
      },
      {
        role: "user",
        content: `以下はSlackのスレッドの内容です。これを簡潔に要約してください。\n\n${threadText}`,
      },
    ];

    const response = await axios.post<OpenRouterResponse>(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "meta-llama/llama-4-maverick:free",
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenRouter APIエラー:", error);
    throw new Error("要約の生成中にエラーが発生しました");
  }
};
