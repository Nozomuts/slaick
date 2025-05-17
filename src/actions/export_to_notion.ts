import { App, BlockAction } from "@slack/bolt";
import { exportToNotion } from "../services/notion";

export const actionExportToNotion = async (app: App) => {
  app.action<BlockAction>("export_to_notion", async ({ ack, body, client }) => {
    await ack();

    if (body.actions.length === 0) {
      throw new Error("アクションデータが見つかりません");
    }
    const action = body.actions[0];
    if (action.type !== "button" || !action.value) {
      throw new Error("要約データが見つかりません");
    }
    const [channelId, threadTs, encodedSummary] = action.value.split(":");
    const summary = decodeURIComponent(encodedSummary);

    try {
      const channelInfo = await client.conversations.info({
        channel: channelId,
      });
      const channelName = channelInfo.channel?.name || "チャンネル";

      const threadMessages = await client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: 1,
      });

      const firstMessageText = threadMessages.messages?.[0]?.text || "";
      const shortText =
        firstMessageText.length > 30
          ? firstMessageText.substring(0, 30) + "..."
          : firstMessageText;

      const title = `${channelName} スレッド要約: ${shortText}`;

      const result = await exportToNotion(summary, { title });

      if (channelId) {
        if (result.success) {
          await client.chat.update({
            channel: channelId,
            ts: threadTs,
            text: "✅ Notionへのエクスポートが完了しました",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "✅ Notionへのエクスポートが完了しました",
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `<${result.url}|Notionで開く>`,
                },
              },
            ],
          });
        } else {
          await client.chat.update({
            channel: channelId,
            ts: threadTs,
            text: "❌ Notionへのエクスポートに失敗しました",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `❌ Notionへのエクスポートに失敗しました: ${result.error}`,
                },
              },
            ],
          });
        }
      } else {
        await client.chat.postEphemeral({
          channel: channelId,
          user: body.user.id,
          text: result.success
            ? `✅ Notionへのエクスポートが完了しました: <${result.url}|Notionで開く>`
            : `❌ Notionへのエクスポートに失敗しました: ${result.error}`,
        });
      }
    } catch (error) {
      console.error("Notionエクスポートエラー:", error);
      if (body.message) {
        await client.chat.update({
          channel: channelId,
          ts: body.message.ts,
          text: `❌ Notionへのエクスポートに失敗しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
        });
      } else {
        await client.chat.postEphemeral({
          channel: channelId,
          user: body.user.id,
          text: `❌ Notionへのエクスポートに失敗しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
        });
      }
    }
  });
};
