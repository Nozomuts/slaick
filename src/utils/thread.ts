import { WebClient } from "@slack/web-api";
import { SummaryVisibility } from "../types";

export const getThreadMessages = async (
  client: WebClient,
  channelId: string,
  threadTs: string
): Promise<string> => {
  try {
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
    });

    if (!result.messages || result.messages.length === 0) {
      throw new Error("スレッドメッセージが見つかりませんでした");
    }

    // スレッド内のすべてのメッセージのテキストを連結
    return result.messages
      .filter((message) => message.text)
      .map((message) => message.text)
      .join("\n\n");
  } catch (error) {
    console.error("スレッドメッセージ取得エラー:", error);
    throw new Error("スレッドメッセージの取得中にエラーが発生しました");
  }
};

export const postSummaryToThread = async (
  client: WebClient,
  channelId: string,
  threadTs: string,
  summaryText: string,
  visibility: SummaryVisibility = "public"
): Promise<void> => {
  try {
    if (visibility === "public") {
      // スレッドに公開メッセージとして投稿
      await client.chat.postMessage({
        channel: channelId,
        text: `📝 *スレッド要約*\n\n${summaryText}`,
        thread_ts: threadTs,
      });
    } else {
      // エフェメラル（個人だけに見える）メッセージとして投稿
      // Note: エフェメラルメッセージはスレッド内で使用できないため、
      // スレッドのURLなどとともに表示する
      const permalink = await client.chat.getPermalink({
        channel: channelId,
        message_ts: threadTs,
      });

      await client.chat.postEphemeral({
        channel: channelId,
        user: client.token?.toString().split(".")[1] || "", // 現在のユーザーID
        text: `📝 *スレッド要約* (非公開)\n\n${summaryText}\n\n<${permalink.permalink}|元のスレッドを開く>`,
      });
    }
  } catch (error) {
    console.error("メッセージ投稿エラー:", error);
    throw new Error("要約の投稿中にエラーが発生しました");
  }
};
