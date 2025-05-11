import { App } from "@slack/bolt";
import * as dotenv from "dotenv";
import { summarizeThread } from "./utils/openRouter";
import {
  getThreadMessages,
  getChannelMessages,
  postSummaryToThread,
  postChannelSummary,
  uploadMarkdownFile,
} from "./utils/thread";
import { exportToNotion } from "./utils/notion";
import { generateMarkdown, generateChannelMarkdown } from "./utils/markdown";

dotenv.config();

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  token: process.env.SLACK_BOT_TOKEN!,
});

// スラッシュコマンドハンドラ
app.command("/summarize", async ({ command, ack, respond, client, body }) => {
  await ack();

  try {
    // エフェメラルメッセージで処理中を通知
    await respond({
      text: "📝 要約を作成しています...",
      response_type: "ephemeral",
    });

    const channelId = command.channel_id;
    // コマンド引数からスレッドTSを取得（引数がない場合は直接コマンドが実行されたチャンネルを対象）
    const threadTs = command.text || command.ts;

    // スレッドメッセージを取得
    const threadText = await getThreadMessages(client, channelId, threadTs);

    // OpenRouterでスレッドを要約
    const summary = await summarizeThread(threadText);

    // ユーザーID取得
    const userId = body.user_id;

    // まず非公開で要約結果を表示
    await postSummaryToThread(client, channelId, threadTs, summary, "private");

    // 公開するボタン付きの通知
    await respond({
      text: "📝 スレッドの要約が完了しました（あなただけに表示されています）",
      response_type: "ephemeral",
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
              value: `${channelId}:${threadTs}:${encodeURIComponent(summary)}`,
              action_id: "publish_summary_to_thread",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Notionにエクスポート",
                emoji: true,
              },
              value: `${channelId}:${threadTs}:${encodeURIComponent(summary)}`,
              action_id: "export_to_notion",
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Markdownで表示",
                emoji: true,
              },
              value: `${channelId}:${threadTs}:${encodeURIComponent(summary)}`,
              action_id: "show_markdown",
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("要約処理エラー:", error);
    await respond({
      text: `エラーが発生しました: ${
        error instanceof Error ? error.message : "不明なエラー"
      }`,
      response_type: "ephemeral",
    });
  }
});

// 公開要約ボタンのアクションハンドラ
app.action("publish_summary_to_thread", async ({ ack, body, client }) => {
  await ack();

  try {
    // @ts-ignore - bodyの型定義を簡略化
    const value = body.actions?.[0]?.value;

    if (!value) {
      throw new Error("要約データが見つかりません");
    }

    // 値からチャンネルID、スレッドTS、要約テキストを取得
    const [channelId, threadTs, encodedSummary] = value.split(":");
    const summary = decodeURIComponent(encodedSummary);

    // スレッドに公開として投稿
    await postSummaryToThread(client, channelId, threadTs, summary, "public");

    // 確認メッセージを送信
    // @ts-ignore - bodyの型定義を簡略化
    await client.chat.update({
      // @ts-ignore - bodyの型定義を簡略化
      channel: body.channel?.id,
      // @ts-ignore - bodyの型定義を簡略化
      ts: body.message?.ts,
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
  } catch (error) {
    console.error("要約公開エラー:", error);
  }
});

// Notionへのエクスポートボタンのアクションハンドラ
app.action("export_to_notion", async ({ ack, body, client, respond }) => {
  await ack();

  try {
    // @ts-ignore - bodyの型定義を簡略化
    const value = body.actions?.[0]?.value;

    if (!value) {
      throw new Error("要約データが見つかりません");
    }

    // 値からチャンネルID、スレッドTS、要約テキストを取得
    const [channelId, threadTs, encodedSummary] = value.split(":");
    const summary = decodeURIComponent(encodedSummary);

    // チャンネル名を取得（タイトルに使用）
    const channelInfo = await client.conversations.info({
      channel: channelId,
    });
    const channelName = channelInfo.channel?.name || "チャンネル";

    // スレッドの最初のメッセージを取得してタイトルに使用
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

    // タイトルを作成
    const title = `${channelName} スレッド要約: ${shortText}`;

    // Notionにエクスポート
    const result = await exportToNotion(summary, { title });

    if (result.success) {
      // 成功メッセージ
      // @ts-ignore - bodyの型定義を簡略化
      await client.chat.update({
        // @ts-ignore - bodyの型定義を簡略化
        channel: body.channel?.id,
        // @ts-ignore - bodyの型定義を簡略化
        ts: body.message?.ts,
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
      // エラーメッセージ
      // @ts-ignore - bodyの型定義を簡略化
      await client.chat.update({
        // @ts-ignore - bodyの型定義を簡略化
        channel: body.channel?.id,
        // @ts-ignore - bodyの型定義を簡略化
        ts: body.message?.ts,
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
  } catch (error) {
    console.error("Notionエクスポートエラー:", error);
    // @ts-ignore - bodyの型定義を簡略化
    await client.chat.update({
      // @ts-ignore - bodyの型定義を簡略化
      channel: body.channel?.id,
      // @ts-ignore - bodyの型定義を簡略化
      ts: body.message?.ts,
      text: "❌ Notionへのエクスポートに失敗しました",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `❌ Notionへのエクスポートに失敗しました: ${
              error instanceof Error ? error.message : "不明なエラー"
            }`,
          },
        },
      ],
    });
  }
});

// マークダウン表示ボタンのアクションハンドラ
app.action("show_markdown", async ({ ack, body, client }) => {
  await ack();

  try {
    // @ts-ignore - bodyの型定義を簡略化
    const value = body.actions?.[0]?.value;

    if (!value) {
      throw new Error("要約データが見つかりません");
    }

    // 値からチャンネルID、スレッドTS、要約テキストを取得
    const [channelId, threadTs, encodedSummary] = value.split(":");
    const summary = decodeURIComponent(encodedSummary);

    // マークダウンを生成
    const markdown = await generateMarkdown(
      client,
      channelId,
      threadTs,
      summary
    );

    // チャンネル名を取得（ファイル名に使用）
    const channelInfo = await client.conversations.info({
      channel: channelId,
    });
    const channelName = channelInfo.channel?.name || "channel";

    // 日付を取得（ファイル名に使用）
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10).replace(/-/g, "");

    // ファイル名を作成
    const fileName = `${channelName}_thread_summary_${dateStr}.md`;

    // マークダウンファイルをSlackにアップロード
    const fileUrl = await uploadMarkdownFile(
      client,
      // @ts-ignore - bodyの型定義を簡略化
      body.channel?.id || channelId,
      markdown,
      fileName,
      "スレッド要約"
    );

    // マークダウンをコードブロックとして表示し、ダウンロードリンクを提供
    // @ts-ignore - bodyの型定義を簡略化
    await client.chat.update({
      // @ts-ignore - bodyの型定義を簡略化
      channel: body.channel?.id,
      // @ts-ignore - bodyの型定義を簡略化
      ts: body.message?.ts,
      text: "📝 Markdown形式の要約",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📝 *Markdown形式の要約*\n\nマークダウンファイルが作成されました。以下のリンクからダウンロードできます。",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<${fileUrl}|${fileName} をダウンロード>`,
          },
        },
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
                text: "元の画面に戻る",
                emoji: true,
              },
              value: `${channelId}:${threadTs}:${encodeURIComponent(summary)}`,
              action_id: "back_to_summary",
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("Markdown表示エラー:", error);
    // @ts-ignore - bodyの型定義を簡略化
    await client.chat.update({
      // @ts-ignore - bodyの型定義を簡略化
      channel: body.channel?.id,
      // @ts-ignore - bodyの型定義を簡略化
      ts: body.message?.ts,
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
        {
          type: "actions",
          block_id: "markdown_error_actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "元の画面に戻る",
                emoji: true,
              },
              // @ts-ignore - bodyの型定義を簡略化
              value: body.actions?.[0]?.value,
              action_id: "back_to_summary",
            },
          ],
        },
      ],
    });
  }
});

// 「元の画面に戻る」ボタンのアクションハンドラ
app.action("back_to_summary", async ({ ack, body, client }) => {
  await ack();

  try {
    // @ts-ignore - bodyの型定義を簡略化
    const value = body.actions?.[0]?.value;

    if (!value) {
      throw new Error("要約データが見つかりません");
    }

    // 値からチャンネルID、スレッドTS、要約テキストを取得
    const [channelId, threadTs, encodedSummary] = value.split(":");
    const summary = decodeURIComponent(encodedSummary);

    // threadTsが"channel"で始まる場合はチャンネル要約、そうでなければスレッド要約
    if (threadTs.startsWith("channel:")) {
      const messageCount = parseInt(threadTs.replace("channel:", ""));

      // 元のチャンネル要約画面に戻す
      // @ts-ignore - bodyの型定義を簡略化
      await client.chat.update({
        // @ts-ignore - bodyの型定義を簡略化
        channel: body.channel?.id,
        // @ts-ignore - bodyの型定義を簡略化
        ts: body.message?.ts,
        text: "📝 チャンネルの要約が完了しました（あなただけに表示されています）",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📝 *チャンネル要約が完了しました (最新${messageCount}件)*\n\n要約結果はあなただけに表示されています。チャンネルに公開することもできます。`,
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
                value: `${channelId}:channel:${messageCount}:${encodedSummary}`,
                action_id: "publish_channel_summary",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Notionにエクスポート",
                  emoji: true,
                },
                value: `${channelId}:channel:${messageCount}:${encodedSummary}`,
                action_id: "export_channel_to_notion",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Markdownで表示",
                  emoji: true,
                },
                value: `${channelId}:channel:${messageCount}:${encodedSummary}`,
                action_id: "show_channel_markdown",
              },
            ],
          },
        ],
      });
    } else {
      // 元のスレッド要約画面に戻す
      // @ts-ignore - bodyの型定義を簡略化
      await client.chat.update({
        // @ts-ignore - bodyの型定義を簡略化
        channel: body.channel?.id,
        // @ts-ignore - bodyの型定義を簡略化
        ts: body.message?.ts,
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
                value: `${channelId}:${threadTs}:${encodedSummary}`,
                action_id: "publish_summary_to_thread",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Notionにエクスポート",
                  emoji: true,
                },
                value: `${channelId}:${threadTs}:${encodedSummary}`,
                action_id: "export_to_notion",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Markdownで表示",
                  emoji: true,
                },
                value: `${channelId}:${threadTs}:${encodedSummary}`,
                action_id: "show_markdown",
              },
            ],
          },
        ],
      });
    }
  } catch (error) {
    console.error("画面復元エラー:", error);
  }
});

// チャンネル要約コマンド
app.command(
  "/summarize-channel",
  async ({ command, ack, respond, client, body }) => {
    await ack();

    try {
      // エフェメラルメッセージで処理中を通知
      await respond({
        text: "📝 チャンネルの要約を作成しています...",
        response_type: "ephemeral",
      });

      const channelId = command.channel_id;

      // コマンド引数からメッセージ数を取得（引数がない場合はデフォルト100件）
      let messageCount = 100;
      if (command.text) {
        const parsedCount = parseInt(command.text);
        if (!isNaN(parsedCount) && parsedCount > 0) {
          messageCount = Math.min(parsedCount, 1000); // 最大1000件に制限
        }
      }

      // チャンネルのメッセージを取得
      const channelText = await getChannelMessages(
        client,
        channelId,
        messageCount
      );

      // OpenRouterでチャンネルを要約
      const summary = await summarizeThread(channelText);

      // ユーザーID取得
      const userId = body.user_id;

      // 公開するボタン付きの通知
      await respond({
        text: `📝 チャンネルの要約が完了しました (最新${messageCount}件)（あなただけに表示されています）`,
        response_type: "ephemeral",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📝 *チャンネル要約が完了しました (最新${messageCount}件)*\n\n${summary}\n\n要約結果はあなただけに表示されています。チャンネルに公開することもできます。`,
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
                value: `${channelId}:channel:${messageCount}:${encodeURIComponent(
                  summary
                )}`,
                action_id: "publish_channel_summary",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Notionにエクスポート",
                  emoji: true,
                },
                value: `${channelId}:channel:${messageCount}:${encodeURIComponent(
                  summary
                )}`,
                action_id: "export_channel_to_notion",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Markdownで表示",
                  emoji: true,
                },
                value: `${channelId}:channel:${messageCount}:${encodeURIComponent(
                  summary
                )}`,
                action_id: "show_channel_markdown",
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error("チャンネル要約処理エラー:", error);
      await respond({
        text: `エラーが発生しました: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`,
        response_type: "ephemeral",
      });
    }
  }
);

// チャンネル要約公開ボタンのアクションハンドラ
app.action("publish_channel_summary", async ({ ack, body, client }) => {
  await ack();

  try {
    // @ts-ignore - bodyの型定義を簡略化
    const value = body.actions?.[0]?.value;

    if (!value) {
      throw new Error("要約データが見つかりません");
    }

    // 値からチャンネルID、メッセージ数、要約テキストを取得
    const [channelId, channelMarker, messageCountStr, encodedSummary] =
      value.split(":");
    const messageCount = parseInt(messageCountStr);
    const summary = decodeURIComponent(encodedSummary);

    // チャンネルに公開として投稿
    const postedMessageTs = await postChannelSummary(
      client,
      channelId,
      summary,
      messageCount,
      "public"
    );

    // 確認メッセージを送信
    // @ts-ignore - bodyの型定義を簡略化
    await client.chat.update({
      // @ts-ignore - bodyの型定義を簡略化
      channel: body.channel?.id,
      // @ts-ignore - bodyの型定義を簡略化
      ts: body.message?.ts,
      text: "✅ 要約をチャンネルに公開しました",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "✅ 要約をチャンネルに公開しました",
          },
        },
      ],
    });
  } catch (error) {
    console.error("チャンネル要約公開エラー:", error);
  }
});

// チャンネル要約のマークダウンダウンロードボタンのアクションハンドラ
app.action("show_channel_markdown", async ({ ack, body, client }) => {
  await ack();

  try {
    // @ts-ignore - bodyの型定義を簡略化
    const value = body.actions?.[0]?.value;

    if (!value) {
      throw new Error("要約データが見つかりません");
    }

    // 値からチャンネルID、メッセージ数、要約テキストを取得
    const [channelId, channelMarker, messageCountStr, encodedSummary] =
      value.split(":");
    const messageCount = parseInt(messageCountStr);
    const summary = decodeURIComponent(encodedSummary);

    // マークダウンを生成
    const markdown = await generateChannelMarkdown(
      client,
      channelId,
      summary,
      messageCount
    );

    // チャンネル名を取得（ファイル名に使用）
    const channelInfo = await client.conversations.info({
      channel: channelId,
    });
    const channelName = channelInfo.channel?.name || "channel";

    // 日付を取得（ファイル名に使用）
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10).replace(/-/g, "");

    // ファイル名を作成
    const fileName = `${channelName}_channel_summary_${dateStr}.md`;

    // マークダウンファイルをSlackにアップロード
    const fileUrl = await uploadMarkdownFile(
      client,
      // @ts-ignore - bodyの型定義を簡略化
      body.channel?.id || channelId,
      markdown,
      fileName,
      `チャンネル要約（最新${messageCount}件）`
    );

    // マークダウンをコードブロックとして表示し、ダウンロードリンクを提供
    // @ts-ignore - bodyの型定義を簡略化
    await client.chat.update({
      // @ts-ignore - bodyの型定義を簡略化
      channel: body.channel?.id,
      // @ts-ignore - bodyの型定義を簡略化
      ts: body.message?.ts,
      text: "📝 Markdown形式の要約",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📝 *Markdown形式のチャンネル要約*\n\nマークダウンファイルが作成されました。以下のリンクからダウンロードできます。",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<${fileUrl}|${fileName} をダウンロード>`,
          },
        },
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
                text: "元の画面に戻る",
                emoji: true,
              },
              value: `${channelId}:channel:${messageCount}:${encodedSummary}`,
              action_id: "back_to_summary",
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("チャンネルMarkdown表示エラー:", error);
    // @ts-ignore - bodyの型定義を簡略化
    await client.chat.update({
      // @ts-ignore - bodyの型定義を簡略化
      channel: body.channel?.id,
      // @ts-ignore - bodyの型定義を簡略化
      ts: body.message?.ts,
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
        {
          type: "actions",
          block_id: "markdown_error_actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "元の画面に戻る",
                emoji: true,
              },
              // @ts-ignore - bodyの型定義を簡略化
              value: body.actions?.[0]?.value,
              action_id: "back_to_summary",
            },
          ],
        },
      ],
    });
  }
});

// チャンネル要約のNotionエクスポートボタンのアクションハンドラ
app.action("export_channel_to_notion", async ({ ack, body, client }) => {
  await ack();

  try {
    // @ts-ignore - bodyの型定義を簡略化
    const value = body.actions?.[0]?.value;

    if (!value) {
      throw new Error("要約データが見つかりません");
    }

    // 値からチャンネルID、メッセージ数、要約テキストを取得
    const [channelId, channelMarker, messageCountStr, encodedSummary] =
      value.split(":");
    const messageCount = parseInt(messageCountStr);
    const summary = decodeURIComponent(encodedSummary);

    // チャンネル名を取得（タイトルに使用）
    const channelInfo = await client.conversations.info({
      channel: channelId,
    });
    const channelName = channelInfo.channel?.name || "チャンネル";

    // タイトルを作成
    const title = `${channelName} チャンネル要約 (最新${messageCount}件)`;

    // Notionにエクスポート
    const result = await exportToNotion(summary, { title });

    if (result.success) {
      // 成功メッセージ
      // @ts-ignore - bodyの型定義を簡略化
      await client.chat.update({
        // @ts-ignore - bodyの型定義を簡略化
        channel: body.channel?.id,
        // @ts-ignore - bodyの型定義を簡略化
        ts: body.message?.ts,
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
      // エラーメッセージ
      // @ts-ignore - bodyの型定義を簡略化
      await client.chat.update({
        // @ts-ignore - bodyの型定義を簡略化
        channel: body.channel?.id,
        // @ts-ignore - bodyの型定義を簡略化
        ts: body.message?.ts,
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
  } catch (error) {
    console.error("チャンネルNotionエクスポートエラー:", error);
    // @ts-ignore - bodyの型定義を簡略化
    await client.chat.update({
      // @ts-ignore - bodyの型定義を簡略化
      channel: body.channel?.id,
      // @ts-ignore - bodyの型定義を簡略化
      ts: body.message?.ts,
      text: "❌ Notionへのエクスポートに失敗しました",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `❌ Notionへのエクスポートに失敗しました: ${
              error instanceof Error ? error.message : "不明なエラー"
            }`,
          },
        },
      ],
    });
  }
});

(async () => {
  await app.start(Number(process.env.PORT) || 3000);
  console.log("⚡️ Slack bot is running");
})();
