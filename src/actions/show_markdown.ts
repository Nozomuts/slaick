import { App, BlockAction } from "@slack/bolt";
import {
  generateMarkdown,
  generateChannelMarkdown,
} from "../services/markdown";
import { uploadMarkdownFile } from "../services/slack";

export const actionShowMarkdown = async (app: App) => {
  app.action<BlockAction>(
    "show_markdown",
    async ({ ack, body, client, respond }) => {
      await ack();

      if (body.actions.length === 0) {
        throw new Error("アクションデータが見つかりません");
      }
      const action = body.actions[0];
      if (action.type !== "button" || !action.value) {
        throw new Error("要約データが見つかりません");
      }

      const [channelId, summaryType, ...rest] = action.value.split(":");
      const encodedSummary = rest.pop() || "";
      const summary = decodeURIComponent(encodedSummary);
      const threadTs = summaryType === "thread" ? rest[0] : summaryType;
      const isChannel = summaryType === "channel";
      const messageCount = isChannel ? parseInt(rest[0] || "0") : 0;
      try {
        const markdown = isChannel
          ? await generateChannelMarkdown(
              client,
              channelId,
              summary,
              messageCount
            )
          : await generateMarkdown(client, channelId, threadTs, summary);

        const fileUrl = await uploadMarkdownFile(
          client,
          channelId,
          markdown,
          `thread_summary_${Date.now()}.md`,
          "スレッド要約"
        );

        await client.chat.postEphemeral({
          channel: channelId,
          user: body.user.id,
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
            {
              type: "actions",
              block_id: "markdown_actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "メッセージを削除",
                    emoji: true,
                  },
                  style: "danger",
                  value: `${channelId}:${body.message?.ts}`,
                  action_id: "delete_message",
                },
              ],
            },
          ],
        });
      } catch (error) {
        console.error("Markdown表示エラー:", error);
        await client.chat.postEphemeral({
          channel: channelId,
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
    }
  );
};
