import { App } from "@slack/bolt";
import * as dotenv from "dotenv";
import { summarizeThread, summarizeChannelContent } from "./utils/openRouter";
import {
  getThreadMessages,
  getChannelMessages,
  postSummaryToThread,
  postChannelSummary,
  uploadMarkdownFile,
} from "./utils/slack";
import { exportToNotion } from "./utils/notion";
import { generateMarkdown, generateChannelMarkdown } from "./utils/markdown";

dotenv.config();

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// メッセージイベントのハンドラ
app.event("app_mention", async ({ event, say, client }) => {
  try {
    const channelId = event.channel;

    if (event.thread_ts) {
      // スレッド内でメンションされた場合、スレッドを要約
      // 処理中メッセージを送信
      await say({
        text: "📝 スレッドの要約を作成しています...",
        thread_ts: event.thread_ts,
      });

      // スレッドメッセージを取得
      const threadText = await getThreadMessages(
        client,
        channelId,
        event.thread_ts
      );

      // OpenRouterでスレッドを要約
      const summary = await summarizeThread(threadText);

      // スレッドに要約を投稿
      await postSummaryToThread(
        client,
        channelId,
        event.thread_ts,
        summary,
        "public"
      );
    } else {
      // チャンネル直接でメンションされた場合、チャンネルを要約
      const messageCount = 20; // デフォルトで最新20件を要約

      // 処理中メッセージを送信
      await say({
        text: "📝 チャンネルの要約を作成しています...",
        thread_ts: event.ts,
      });

      // チャンネルのメッセージを取得
      const channelText = await getChannelMessages(
        client,
        channelId,
        messageCount
      );

      // OpenRouterでチャンネルを要約
      const summary = await summarizeChannelContent(channelText, messageCount);

      // 要約を投稿
      await postChannelSummary(
        client,
        channelId,
        summary,
        messageCount,
        "public"
      );
    }
  } catch (error) {
    console.error("メンションイベントエラー:", error);
    await say({
      text: `エラーが発生しました: ${
        error instanceof Error ? error.message : "不明なエラー"
      }`,
      thread_ts: event.thread_ts || event.ts,
    });
  }
});

// 公開要約ボタンのアクションハンドラ
app.action(
  "publish_summary_to_thread",
  async ({ ack, body, client, respond }) => {
    await ack();

    try {
      // bodyがBlockActionPayloadであることを確認
      if (!("actions" in body) || !body.actions || body.actions.length === 0) {
        throw new Error("アクションデータが見つかりません");
      }
      const action = body.actions[0];
      if (action.type !== "button" || !action.value) {
        throw new Error("要約データが見つかりません");
      }
      const value = action.value;

      // 値からチャンネルID、スレッドTS、要約テキストを取得
      const [channelId, threadTs, encodedSummary] = value.split(":");
      const summary = decodeURIComponent(encodedSummary);

      // スレッドに公開として投稿
      await postSummaryToThread(client, channelId, threadTs, summary, "public");

      // 確認メッセージを送信
      if (body.channel?.id) {
        await client.chat.update({
          channel: body.channel.id,
          ts: String(Date.now() / 1000),
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
      } else {
        // エフェメラルメッセージで通知 (元のメッセージを更新できない場合)
        await respond({
          text: "✅ 要約をスレッドに公開しました",
          replace_original: false,
          response_type: "ephemeral",
        });
      }
    } catch (error) {
      console.error("要約公開エラー:", error);
      if ("respond" in body && typeof respond === "function") {
        await respond({
          text: `エラーが発生しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
          response_type: "ephemeral",
          replace_original: false,
        });
      }
    }
  }
);

// Notionへのエクスポートボタンのアクションハンドラ
app.action("export_to_notion", async ({ ack, body, client, respond }) => {
  await ack();

  try {
    // bodyがBlockActionPayloadであることを確認
    if (!("actions" in body) || !body.actions || body.actions.length === 0) {
      throw new Error("アクションデータが見つかりません");
    }
    const action = body.actions[0];
    if (action.type !== "button" || !action.value) {
      throw new Error("要約データが見つかりません");
    }
    const value = action.value;

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

    if (body.channel?.id) {
      if (result.success) {
        // 成功メッセージ
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
        // エラーメッセージ
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
    if (body.channel?.id) {
      await client.chat.update({
        channel: body.channel.id,
        ts: String(Date.now() / 1000),
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
});

// マークダウン表示ボタンのアクションハンドラ
app.action("show_markdown", async ({ ack, body, client, respond }) => {
  await ack();

  try {
    // bodyがBlockActionPayloadであることを確認
    if (!("actions" in body) || !body.actions || body.actions.length === 0) {
      throw new Error("アクションデータが見つかりません");
    }
    const action = body.actions[0];
    if (action.type !== "button" || !action.value) {
      throw new Error("要約データが見つかりません");
    }
    const value = action.value;

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
      body.channel?.id || channelId,
      markdown,
      fileName,
      "スレッド要約"
    );

    // マークダウンをコードブロックとして表示し、ダウンロードリンクを提供
    if (body.channel?.id) {
      await client.chat.update({
        channel: body.channel.id,
        ts: String(Date.now() / 1000),
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
                value: `${channelId}:${threadTs}:${encodeURIComponent(
                  summary
                )}`,
                action_id: "back_to_summary",
              },
            ],
          },
        ],
      });
    } else {
      await respond({
        text: `📝 Markdown形式の要約\n<${fileUrl}|${fileName} をダウンロード>`,
        response_type: "ephemeral",
        replace_original: false,
      });
    }
  } catch (error) {
    console.error("Markdown表示エラー:", error);
    if (body.channel?.id) {
      await client.chat.update({
        channel: body.channel.id,
        ts: String(Date.now() / 1000),
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
                value:
                  "actions" in body &&
                  body.actions &&
                  body.actions.length > 0 &&
                  body.actions[0].type === "button"
                    ? body.actions[0].value
                    : undefined,
                action_id: "back_to_summary",
              },
            ],
          },
        ],
      });
    } else if ("respond" in body && typeof respond === "function") {
      await respond({
        text: `❌ Markdown表示に失敗しました: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`,
        response_type: "ephemeral",
        replace_original: false,
      });
    }
  }
});

// 「元の画面に戻る」ボタンのアクションハンドラ
app.action("back_to_summary", async ({ ack, body, client, respond }) => {
  await ack();

  try {
    // bodyがBlockActionPayloadであることを確認
    if (!("actions" in body) || !body.actions || body.actions.length === 0) {
      throw new Error("アクションデータが見つかりません");
    }
    const action = body.actions[0];
    if (action.type !== "button" || !action.value) {
      throw new Error("要約データが見つかりません");
    }
    const value = action.value;

    // 値からチャンネルID、スレッドTS、要約テキストを取得
    const [channelId, threadTsOrMarker, ...rest] = value.split(":");
    const encodedSummary = rest.pop() || "";
    const summary = decodeURIComponent(encodedSummary);
    const messageCountOrThreadTs = rest.join(":") || threadTsOrMarker;

    if (!body.channel?.id) {
      await respond({
        text: "元のメッセージを特定できませんでした。",
        response_type: "ephemeral",
        replace_original: false,
      });
      return;
    }

    // threadTsが"channel"で始まる場合はチャンネル要約、そうでなければスレッド要約
    if (threadTsOrMarker === "channel") {
      const messageCount = parseInt(messageCountOrThreadTs);

      // 元のチャンネル要約画面に戻す
      await client.chat.update({
        channel: body.channel.id,
        ts: String(Date.now() / 1000),
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
      const threadTs = messageCountOrThreadTs;
      await client.chat.update({
        channel: body.channel.id,
        ts: String(Date.now() / 1000),
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
    if ("respond" in body && typeof respond === "function") {
      await respond({
        text: `エラーが発生しました: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`,
        response_type: "ephemeral",
        replace_original: false,
      });
    }
  }
});

// チャンネル要約のNotionエクスポートボタンのアクションハンドラ

// チャンネル要約公開ボタンのアクションハンドラ
app.action(
  "publish_channel_summary",
  async ({ ack, body, client, respond }) => {
    await ack();

    try {
      // bodyがBlockActionPayloadであることを確認
      if (!("actions" in body) || !body.actions || body.actions.length === 0) {
        throw new Error("アクションデータが見つかりません");
      }
      const action = body.actions[0];
      if (action.type !== "button" || !action.value) {
        throw new Error("要約データが見つかりません");
      }
      const value = action.value;

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
      if (body.channel?.id) {
        await client.chat.update({
          channel: body.channel.id,
          ts: String(Date.now() / 1000),
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
      } else {
        await respond({
          text: "✅ 要約をチャンネルに公開しました",
          response_type: "ephemeral",
          replace_original: false,
        });
      }
    } catch (error) {
      console.error("チャンネル要約公開エラー:", error);
      if ("respond" in body && typeof respond === "function") {
        await respond({
          text: `エラーが発生しました: ${
            error instanceof Error ? error.message : "不明なエラー"
          }`,
          response_type: "ephemeral",
          replace_original: false,
        });
      }
    }
  }
);

// チャンネル要約のマークダウンダウンロードボタンのアクションハンドラ
app.action("show_channel_markdown", async ({ ack, body, client, respond }) => {
  await ack();

  try {
    // bodyがBlockActionPayloadであることを確認
    if (!("actions" in body) || !body.actions || body.actions.length === 0) {
      throw new Error("アクションデータが見つかりません");
    }
    const action = body.actions[0];
    if (action.type !== "button" || !action.value) {
      throw new Error("要約データが見つかりません");
    }
    const value = action.value;

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
      body.channel?.id || channelId,
      markdown,
      fileName,
      `チャンネル要約（最新${messageCount}件）`
    );

    // マークダウンをコードブロックとして表示し、ダウンロードリンクを提供
    if (body.channel?.id) {
      await client.chat.update({
        channel: body.channel.id,
        ts: String(Date.now() / 1000),
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
    } else {
      await respond({
        text: `📝 Markdown形式のチャンネル要約\n<${fileUrl}|${fileName} をダウンロード>`,
        response_type: "ephemeral",
        replace_original: false,
      });
    }
  } catch (error) {
    console.error("チャンネルMarkdown表示エラー:", error);
    if (body.channel?.id) {
      await client.chat.update({
        channel: body.channel.id,
        ts: String(Date.now() / 1000),
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
                value:
                  "actions" in body &&
                  body.actions &&
                  body.actions.length > 0 &&
                  body.actions[0].type === "button"
                    ? body.actions[0].value
                    : undefined,
                action_id: "back_to_summary",
              },
            ],
          },
        ],
      });
    } else if ("respond" in body && typeof respond === "function") {
      await respond({
        text: `❌ Markdown表示に失敗しました: ${
          error instanceof Error ? error.message : "不明なエラー"
        }`,
        response_type: "ephemeral",
        replace_original: false,
      });
    }
  }
});

// チャンネル要約のNotionエクスポートボタンのアクションハンドラ
app.action(
  "export_channel_to_notion",
  async ({ ack, body, client, respond }) => {
    await ack();

    try {
      // bodyがBlockActionPayloadであることを確認
      if (!("actions" in body) || !body.actions || body.actions.length === 0) {
        throw new Error("アクションデータが見つかりません");
      }
      const action = body.actions[0];
      if (action.type !== "button" || !action.value) {
        throw new Error("要約データが見つかりません");
      }
      const value = action.value;

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

      if (body.channel?.id) {
        if (result.success) {
          // 成功メッセージ
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
          // エラーメッセージ
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
      console.error("チャンネルNotionエクスポートエラー:", error);
      if (body.channel?.id) {
        await client.chat.update({
          channel: body.channel.id,
          ts: String(Date.now() / 1000),
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

(async () => {
  await app.start(Number(process.env.PORT) || 3000);
  console.log("⚡️ Slack bot is running");
})();
