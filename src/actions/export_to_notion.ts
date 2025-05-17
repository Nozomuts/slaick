import { App, BlockAction } from "@slack/bolt";
import { exportToNotion } from "../services/notion";
import { initialize } from "../utils";

export const actionExportToNotion = async (app: App) => {
  app.action<BlockAction>("export_to_notion", async ({ ack, body, client }) => {
    await ack();

    const params = initialize(body);

    try {
      const channelInfo = await client.conversations.info({
        channel: params.channelId,
      });
      const channelName = channelInfo.channel?.name || "チャンネル";
      const title = `${channelName} スレッド要約: ${Date.now()}`;
      const result = await exportToNotion(params.summary, { title });

      if (params.type === "channel") {
        if (result.success) {
          await client.chat.postEphemeral({
            channel: params.channelId,
            thread_ts: params.threadTs,
            user: body.user.id,
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
          await client.chat.postEphemeral({
            channel: params.channelId,
            thread_ts: params.threadTs,
            user: body.user.id,
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
          channel: params.channelId,
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
          channel: params.channelId,
          ts: body.message.ts,
          text: `❌ Notionへのエクスポートに失敗しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
        });
      } else {
        await client.chat.postEphemeral({
          channel: params.channelId,
          user: body.user.id,
          text: `❌ Notionへのエクスポートに失敗しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
        });
      }
    }
  });
};
