import { App } from "@slack/bolt";
import { getChannelMessages } from "../services/slack";
import { summarizeChannel } from "../services/openRouter";

export const viewChannelSelectModal = async (app: App) => {
  app.view("channel_select_modal", async ({ ack, body, view, client }) => {
    await ack();

    try {
      const channelId =
        view.state.values.channel_select_block.channel_select.selected_channel;
      if (!channelId) {
        throw new Error("チャンネルが選択されていません");
      }

      const messageCount = 10; // デフォルトで最新10件を要約

      // 処理中メッセージを送信
      await client.chat.postEphemeral({
        channel: channelId,
        user: body.user.id,
        text: "📝 チャンネルの要約を作成しています...",
      });

      const channelText = await getChannelMessages(
        client,
        channelId,
        messageCount
      );

      const summary = await summarizeChannel(channelText, messageCount);

      await client.chat.postEphemeral({
        channel: channelId,
        user: body.user.id,
        text: "📝 チャンネルの要約が完了しました（あなただけに表示されています）",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📝 *チャンネル要約が完了しました (最新${messageCount}件)*\n\n要約結果はあなただけに表示されています。チャンネルに公開することもできます。\n\n${summary}`,
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
                  text: "チャンネルに公開する",
                  emoji: true,
                },
                style: "primary",
                value: `channel:${channelId}:${encodeURIComponent(
                  summary
                )}:${messageCount}`,
                action_id: "publish_summary",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Notionにエクスポート",
                  emoji: true,
                },
                value: `channel:${channelId}:${encodeURIComponent(
                  summary
                )}:${messageCount}`,
                action_id: "export_to_notion",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Markdownで表示",
                  emoji: true,
                },
                value: `channel:${channelId}:${encodeURIComponent(
                  summary
                )}:${messageCount}`,
                action_id: "show_markdown",
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error("チャンネル要約エラー:", error);
      const selectedChannelId =
        view.state.values.channel_select_block.channel_select.selected_channel;
      if (selectedChannelId) {
        await client.chat.postEphemeral({
          channel: selectedChannelId,
          user: body.user.id,
          text: `エラーが発生しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
        });
      }
    }
  });
};
