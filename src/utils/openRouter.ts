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
        model: "meta-llama/llama-4-scout:free",
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          contentType: "application/json",
        },
      }
    );

    if (!response.data.choices || response.data.choices.length === 0 || !response.data.choices[0].message.content) {
        console.error("OpenRouter APIからの応答が無効です (スレッド要約):", response.data);
        throw new Error("スレッド要約の生成中にAPIから無効な応答がありました。");
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenRouter APIエラー (スレッド要約):", error);
    if (axios.isAxiosError(error) && error.response) {
      console.error("OpenRouter APIエラー詳細 (スレッド要約):", error.response.data);
    }
    throw new Error("スレッド要約の生成中にエラーが発生しました");
  }
};

export const summarizeChannelContent = async (channelText: string, messageCount: number): Promise<string> => {
  try {
    const messages: Message[] = [
      {
        role: "system",
        content:
          `あなたは、与えられたSlackチャンネルの会話履歴を要約するアシスタントです。会話履歴は、最新の${messageCount}件のメッセージから構成されています。`,
      },
      {
        role: "user",
        content: `以下のSlackチャンネルのメッセージ履歴（最新${messageCount}件）を簡潔に要約してください。\n\n${channelText}`,
      },
    ];

    const response = await axios.post<OpenRouterResponse>(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "meta-llama/llama-4-scout:free",
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          contentType: "application/json",
        },
      }
    );
    if (!response.data.choices || response.data.choices.length === 0 || !response.data.choices[0].message.content) {
        console.error("OpenRouter APIからの応答が無効です (チャンネル要約):", response.data);
        throw new Error("チャンネル要約の生成中にAPIから無効な応答がありました。");
    }
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenRouter APIエラー (チャンネル要約):", error);
    if (axios.isAxiosError(error) && error.response) {
      console.error("OpenRouter APIエラー詳細 (チャンネル要約):", error.response.data);
    }
    throw new Error("チャンネル要約の生成中にエラーが発生しました");
  }
};
