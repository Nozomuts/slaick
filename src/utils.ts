import { BlockAction, BlockElementAction } from "@slack/bolt";

export const initialize = (body: BlockAction<BlockElementAction>) => {
  if (body.actions.length === 0) {
    throw new Error("アクションデータが見つかりません");
  }
  const action = body.actions[0];
  if (action.type !== "button" || !action.value) {
    throw new Error("要約データが見つかりません");
  }
  const [type, channelId, encodedSummary, ...rest] = action.value.split(":");
  const summary = decodeURIComponent(encodedSummary);
  switch (type) {
    case "channel":
      const messageCount = parseInt(rest[0] || "0");
      return {
        type,
        channelId,
        summary,
        messageCount,
      };
    case "thread":
      const threadTs = rest[0];
      return {
        type,
        channelId,
        summary,
        threadTs,
      };
    default:
      throw new Error("不正な要約タイプです");
  }
};
