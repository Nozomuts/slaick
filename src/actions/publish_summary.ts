import { App, BlockAction } from "@slack/bolt";
import { postThreadSummary, postChannelSummary } from "../services/slack";
import { initialize } from "../utils";

export const actionPublishSummary = async (app: App) => {
  app.action<BlockAction>("publish_summary", async ({ ack, body, client }) => {
    await ack();

    const params = initialize(body);

    try {
      if (params.type === "channel") {
        await postChannelSummary(
          client,
          params.channelId,
          params.summary,
          params.messageCount,
          "public"
        );

        if (body.message) {
          await client.chat.update({
            channel: params.channelId,
            ts: body.message.ts,
            text: `✅ 要約をチャンネルに公開しました (最新${params.messageCount}件)`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `✅ 要約をチャンネルに公開しました (最新${params.messageCount}件)`,
                },
              },
            ],
          });
        }
      } else {
        const threadTs = params.threadTs;
        await postThreadSummary(
          client,
          params.channelId,
          threadTs,
          params.summary,
          "public"
        );

        if (body.message) {
          await client.chat.update({
            channel: params.channelId,
            ts: body.message.ts,
            text: "✅ 要約をスレッドに公開しました",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "✅ 要約をスレッドに公開しました",
                },
              },
            ],
          });
        }
      }
    } catch (error) {
      console.error("要約公開エラー:", error);
      await client.chat.postEphemeral({
        channel: params.channelId,
        user: body.user.id,
        text: `エラーが発生しました: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`,
      });
    }
  });
};
