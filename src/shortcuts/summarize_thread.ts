import { App } from "@slack/bolt";
import { getThreadMessages } from "../services/slack";
import { summarizeThread } from "../services/openRouter";

export const shortcutSummarizeThread = async (app: App) => {
  app.shortcut("summarize_thread", async ({ shortcut, ack, client }) => {
    await ack();

    if (!("message" in shortcut) || !("channel" in shortcut)) {
      console.error("メッセージまたはチャンネルが選択されていません");
      return;
    }

    try {
      const channelId = shortcut.channel.id;
      const messageTs = shortcut.message.ts;

      const threadText = await getThreadMessages(client, channelId, messageTs);

      const summary = await summarizeThread(threadText);

      await client.chat.postEphemeral({
        channel: channelId,
        user: shortcut.user.id,
        thread_ts: messageTs,
        text: "📝 スレッドの要約が完了しました（あなただけに表示されています）",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📝 *スレッド要約が完了しました*\n\n要約結果はあなただけに表示されています。スレッドに公開することもできます。\n\n${summary}`,
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
                action_id: "publish_summary",
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
      await client.chat.postEphemeral({
        channel: shortcut.channel.id,
        user: shortcut.user.id,
        text: `エラーが発生しました: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`,
      });
    }
  });
};
