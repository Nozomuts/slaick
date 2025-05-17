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

/**
 * チャンネルの最新メッセージを取得する
 * @param client Slack WebClient
 * @param channelId チャンネルID
 * @param limit 取得するメッセージの上限数
 * @returns メッセージテキスト
 */
export const getChannelMessages = async (
  client: WebClient,
  channelId: string,
  limit: number = 10
): Promise<string> => {
  try {
    // 最大値を制限
    const actualLimit = Math.min(limit, 100);

    const result = await client.conversations.history({
      channel: channelId,
      limit: actualLimit,
    });

    if (!result.messages || result.messages.length === 0) {
      throw new Error("チャンネルメッセージが見つかりませんでした");
    }

    // ユーザー情報をキャッシュ
    const userCache: Record<string, string> = {};

    // メッセージのユーザー名とテキストを連結
    const messageTexts = await Promise.all(
      result.messages
        .filter(
          (message) =>
            message.text &&
            (!message.subtype || message.subtype === "bot_message")
        ) // 通常のメッセージとボットメッセージのみ
        .map(async (message) => {
          let username = "不明なユーザー";

          if (message.user) {
            // キャッシュからユーザー名を取得、なければAPIで取得
            if (!userCache[message.user]) {
              try {
                const userInfo = await client.users.info({
                  user: message.user,
                });
                if (userInfo.user?.real_name) {
                  userCache[message.user] = userInfo.user.real_name;
                }
              } catch (e) {
                console.error("ユーザー情報取得エラー:", e);
              }
            }
            username = userCache[message.user] || "不明なユーザー";
          } else if (message.username) {
            username = message.username;
          }

          // フォーマットは「ユーザー名: メッセージ内容」
          return `${username}: ${message.text}`;
        })
    );

    return messageTexts.reverse().join("\n\n"); // 古い順に並べ替え
  } catch (error) {
    console.error("チャンネルメッセージ取得エラー:", error);
    throw new Error("チャンネルメッセージの取得中にエラーが発生しました");
  }
};

export const postThreadSummary = async (
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

/**
 * チャンネル要約をチャンネルに投稿する
 */
export const postChannelSummary = async (
  client: WebClient,
  channelId: string,
  summaryText: string,
  messageCount: number,
  visibility: SummaryVisibility = "public"
): Promise<string | undefined> => {
  try {
    if (visibility === "public") {
      // チャンネルに公開メッセージとして投稿
      const result = await client.chat.postMessage({
        channel: channelId,
        text: `📝 *チャンネル要約 (最新${messageCount}件)*\n\n${summaryText}`,
      });

      return result.ts;
    } else {
      // エフェメラル（個人だけに見える）メッセージとして投稿
      await client.chat.postEphemeral({
        channel: channelId,
        user: client.token?.toString().split(".")[1] || "", // 現在のユーザーID
        text: `📝 *チャンネル要約 (最新${messageCount}件)* (非公開)\n\n${summaryText}`,
      });

      return undefined;
    }
  } catch (error) {
    console.error("メッセージ投稿エラー:", error);
    throw new Error("要約の投稿中にエラーが発生しました");
  }
};
