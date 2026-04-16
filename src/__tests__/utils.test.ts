import { initialize } from "../utils";
import { BlockAction, BlockElementAction } from "@slack/bolt";

const createBody = (actionValue: string): BlockAction<BlockElementAction> =>
  ({
    actions: [
      {
        type: "button",
        value: actionValue,
      },
    ],
  }) as unknown as BlockAction<BlockElementAction>;

describe("initialize", () => {
  test("アクションデータが空の場合はエラーをスローする", () => {
    const body = { actions: [] } as unknown as BlockAction<BlockElementAction>;
    expect(() => initialize(body)).toThrow("アクションデータが見つかりません");
  });

  test("ボタン以外のアクションタイプの場合はエラーをスローする", () => {
    const body = {
      actions: [{ type: "static_select" }],
    } as unknown as BlockAction<BlockElementAction>;
    expect(() => initialize(body)).toThrow("要約データが見つかりません");
  });

  test("不正な要約タイプの場合はエラーをスローする", () => {
    const body = createBody("unknown:C123:summary");
    expect(() => initialize(body)).toThrow("不正な要約タイプです");
  });

  test("チャンネルタイプのアクション値を正しくパースする", () => {
    const summary = encodeURIComponent("テスト要約");
    const body = createBody(`channel:C123:${summary}:10`);
    const result = initialize(body);
    expect(result).toEqual({
      type: "channel",
      channelId: "C123",
      summary: "テスト要約",
      messageCount: 10,
    });
  });

  test("スレッドタイプのアクション値を正しくパースする", () => {
    const summary = encodeURIComponent("スレッド要約");
    const body = createBody(`thread:C456:${summary}:1234567890.123456`);
    const result = initialize(body);
    expect(result).toEqual({
      type: "thread",
      channelId: "C456",
      summary: "スレッド要約",
      threadTs: "1234567890.123456",
    });
  });
});
