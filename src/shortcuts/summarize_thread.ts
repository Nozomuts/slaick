import { App } from "@slack/bolt";
import { getThreadMessages } from "../services/slack";
import { summarizeThread } from "../services/openRouter";

export const shortcutSummarizeThread = async (app: App) => {
  app.shortcut("summarize_thread", async ({ shortcut, ack, client }) => {
    await ack();

    const payload = shortcut as any; // メッセージショートカットの型定義のため

    try {
      if (!payload.message?.ts || !payload.channel?.id) {
        throw new Error("メッセージまたはチャンネルが選択されていません");
      }

      // 処理中メッセージを送信
      const processingMessage = await client.chat.postEphemeral({
        channel: payload.channel.id,
        user: shortcut.user.id,
        text: "📝 スレッドの要約を作成しています...",
      });

      const channelId = payload.channel.id;
      const messageTs = payload.message.ts;

      // スレッドメッセージを取得
      const threadText = await getThreadMessages(client, channelId, messageTs);

      // OpenRouterでスレッドを要約
      const summary = await summarizeThread(threadText);

      // エフェメラルメッセージとして要約を表示（ボタン付き）
      await client.chat.postEphemeral({
        channel: channelId,
        user: shortcut.user.id,
        text: "📝 スレッドの要約が完了しました（あなただけに表示されています）",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "📝 *スレッド要約が完了しました*\n\n要約結果はあなただけに表示されています。スレッドに公開することもできます。",
            },
          },
          {
            type: "actions",
            block_id: "summary_visibility",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "スレッドに公開する",
                  emoji: true,
                },
                style: "primary",
                value: `${channelId}:${messageTs}:${encodeURIComponent(
                  summary
                )}`,
                action_id: "publish_summary_to_thread",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Notionにエクスポート",
                  emoji: true,
                },
                value: `${channelId}:${messageTs}:${encodeURIComponent(
                  summary
                )}`,
                action_id: "export_to_notion",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Markdownで表示",
                  emoji: true,
                },
                value: `${channelId}:${messageTs}:${encodeURIComponent(
                  summary
                )}`,
                action_id: "show_markdown",
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error("スレッド要約ショートカットエラー:", error);
      if (payload.channel?.id) {
        await client.chat.postEphemeral({
          channel: payload.channel.id,
          user: shortcut.user.id,
          text: `エラーが発生しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
        });
      }
    }
  });
};
