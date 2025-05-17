import { App, BlockAction } from "@slack/bolt";
import {
  generateChannelMarkdown,
  generateThreadMarkdown,
} from "../services/markdown";
import { uploadMarkdownFile } from "../services/slack";
import { initialize } from "../utils";

export const actionShowMarkdown = async (app: App) => {
  app.action<BlockAction>("show_markdown", async ({ ack, body, client }) => {
    await ack();

    const params = initialize(body);

    try {
      let markdown, fileUrl: string;
      if (params.type === "channel") {
        markdown = await generateChannelMarkdown(
          client,
          params.channelId,
          params.summary,
          params.messageCount
        );
        fileUrl = await uploadMarkdownFile(client, {
          channel_id: params.channelId,
          content: markdown,
          filename: `channel_summary_${Date.now()}.md`,
          title: "チャンネル要約",
        });
      } else {
        markdown = await generateThreadMarkdown(
          client,
          params.channelId,
          params.threadTs,
          params.summary
        );

        fileUrl = await uploadMarkdownFile(client, {
          channel_id: params.channelId,
          content: markdown,
          filename: `thread_summary_${Date.now()}.md`,
          thread_ts: params.threadTs,
          title: "スレッド要約",
        });
      }

      await client.chat.postEphemeral({
        channel: params.channelId,
        user: body.user.id,
        thread_ts: params.threadTs,
        text: `📝 Markdown形式の要約\n<${fileUrl}|Markdownファイルをダウンロード>`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                "プレビュー:\n```markdown\n" +
                markdown.substring(0, 500) +
                (markdown.length > 500 ? "...\n(省略)" : "") +
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
