import { WebClient } from "@slack/web-api";

/**
 * 要約テキストとメタデータからマークダウン形式のテキストを生成
 */
export const generateThreadMarkdown = async (
  client: WebClient,
  channelId: string,
  threadTs: string,
  summary: string
): Promise<string> => {
  try {
    // チャンネル情報の取得
    const channelInfo = await client.conversations.info({
      channel: channelId,
    });

    // スレッドの最初のメッセージを取得
    const threadMessages = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 1,
    });

    const channelName = channelInfo.channel?.name || "チャンネル";
    const firstMessageText = threadMessages.messages?.[0]?.text || "";
    const shortText =
      firstMessageText.length > 50
        ? firstMessageText.substring(0, 50) + "..."
        : firstMessageText;

    // スレッドのURLを取得
    const permalink = await client.chat.getPermalink({
      channel: channelId,
      message_ts: threadTs,
    });

    // 現在の日時
    const now = new Date();
    const formattedDate = now.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // マークダウンの生成
    return `# ${channelName} - スレッド要約

## 元のスレッド情報
- **トピック**: ${shortText}
- **チャンネル**: #${channelName}
- **URL**: ${permalink.permalink}
- **エクスポート日時**: ${formattedDate}

## 要約
${summary}

---

*自動生成された要約です*
`;
  } catch (error) {
    console.error("マークダウン生成エラー:", error);
    // 基本的なマークダウンにフォールバック
    return "";
  }
};

/**
 * チャンネル要約のマークダウンを生成
 */
export const generateChannelMarkdown = async (
  client: WebClient,
  channelId: string,
  summary: string,
  messageCount: number
): Promise<string> => {
  try {
    // チャンネル情報の取得
    const channelInfo = await client.conversations.info({
      channel: channelId,
    });

    const channelName = channelInfo.channel?.name || "チャンネル";

    // チャンネルのURLを生成（ワークスペースのドメインは取得できないため一般的な形式で）
    const teamInfo = await client.team.info();
    const teamDomain = teamInfo.team?.domain || "slack";
    const channelUrl = `https://${teamDomain}.slack.com/archives/${channelId}`;

    // 現在の日時
    const now = new Date();
    const formattedDate = now.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // マークダウンの生成
    return `# ${channelName} - チャンネル要約

## チャンネル情報
- **チャンネル**: #${channelName}
- **対象メッセージ数**: 最新 ${messageCount}件
- **URL**: ${channelUrl}
- **エクスポート日時**: ${formattedDate}

## 要約
${summary}

---

*自動生成された要約です*
`;
  } catch (error) {
    console.error("マークダウン生成エラー:", error);
    // 基本的なマークダウンにフォールバック
    return "";
  }
};
