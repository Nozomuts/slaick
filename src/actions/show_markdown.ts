import { App, BlockAction } from "@slack/bolt";
import {
  generateChannelMarkdown,
  generateThreadMarkdown,
} from "../services/markdown";
import { initialize } from "../utils";

export const actionShowMarkdown = async (app: App) => {
  app.action<BlockAction>("show_markdown", async ({ ack, body, client }) => {
    await ack();

    const params = initialize(body);

    try {
      const markdown =
        params.type === "channel"
          ? await generateChannelMarkdown(
              client,
              params.channelId,
              params.summary,
              params.messageCount
            )
          : await generateThreadMarkdown(
              client,
              params.channelId,
              params.summary,
              params.threadTs
            );

      await client.chat.postEphemeral({
        channel: params.channelId,
        user: body.user.id,
        thread_ts: params.threadTs,
        text: "Markdown形式の要約",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                "```\n" +
                markdown.substring(0, 2000) +
                (markdown.length > 2000 ? "...\n(省略)" : "") +
                "\n```",
            },
          },
        ],
      });
    } catch (error) {
      console.error("Markdown表示エラー:", error);
      await client.chat.postEphemeral({
        channel: params.channelId,
        user: body.user.id,
        text: "❌ Markdown表示に失敗しました",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `❌ Markdown表示に失敗しました: ${
                error instanceof Error ? error.message : "不明なエラー"
              }`,
            },
          },
        ],
      });
    }
  });
};
