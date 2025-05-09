import { WebClient } from "@slack/web-api";

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
  summaryText: string
): Promise<void> => {
  try {
    await client.chat.postMessage({
      channel: channelId,
      text: `📝 *スレッド要約*\n\n${summaryText}`,
      thread_ts: threadTs,
    });
  } catch (error) {
    console.error("メッセージ投稿エラー:", error);
    throw new Error("要約の投稿中にエラーが発生しました");
  }
};
