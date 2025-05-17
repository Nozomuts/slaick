import { App, BlockAction } from "@slack/bolt";
import { exportToNotion } from "../services/notion";

export const actionExportToNotion = async (app: App) => {
  app.action<BlockAction>(
    "export_to_notion",
    async ({ ack, body, client, respond }) => {
      await ack();

      try {
        if (body.actions.length === 0) {
          throw new Error("アクションデータが見つかりません");
        }
        const action = body.actions[0];
        if (action.type !== "button" || !action.value) {
          throw new Error("要約データが見つかりません");
        }
        const [channelId, threadTs, encodedSummary] = action.value.split(":");
        const summary = decodeURIComponent(encodedSummary);

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

        if (body.channel?.id) {
          if (result.success) {
            await client.chat.update({
              channel: body.channel.id,
              ts: String(Date.now() / 1000),
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
              channel: body.channel.id,
              ts: String(Date.now() / 1000),
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
          await respond({
            text: result.success
              ? `✅ Notionへのエクスポートが完了しました: <${result.url}|Notionで開く>`
              : `❌ Notionへのエクスポートに失敗しました: ${result.error}`,
            response_type: "ephemeral",
            replace_original: false,
          });
        }
      } catch (error) {
        console.error("Notionエクスポートエラー:", error);
        if (body.channel?.id && "message" in body && body.message?.ts) {
          await client.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: `❌ Notionへのエクスポートに失敗しました: ${
              error instanceof Error ? error.message : "不明なエラー"
            }`,
          });
        } else if ("respond" in body && typeof respond === "function") {
          await respond({
            text: `❌ Notionへのエクスポートに失敗しました: ${
              error instanceof Error ? error.message : "不明なエラー"
            }`,
            response_type: "ephemeral",
            replace_original: false,
          });
        }
      }
    }
  );
};
