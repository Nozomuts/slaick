import { initialize } from "../utils";
import { BlockAction, BlockElementAction } from "@slack/bolt";

const createMockBody = (actionValue: string): BlockAction<BlockElementAction> =>
  ({
    actions: [
      {
        type: "button",
        value: actionValue,
      },
    ],
  } as unknown as BlockAction<BlockElementAction>);

describe("initialize", () => {
  it("アクションが存在しない場合にエラーをスローする", () => {
    const body = { actions: [] } as unknown as BlockAction<BlockElementAction>;
    expect(() => initialize(body)).toThrow("アクションデータが見つかりません");
  });

  it("アクションタイプがボタンでない場合にエラーをスローする", () => {
    const body = {
      actions: [{ type: "static_select", value: "some_value" }],
    } as unknown as BlockAction<BlockElementAction>;
    expect(() => initialize(body)).toThrow("要約データが見つかりません");
  });

  it("アクション値がない場合にエラーをスローする", () => {
    const body = {
      actions: [{ type: "button" }],
    } as unknown as BlockAction<BlockElementAction>;
    expect(() => initialize(body)).toThrow("要約データが見つかりません");
  });

  it("チャンネルタイプの場合に正しいデータを返す", () => {
    const summary = encodeURIComponent("テスト要約");
    const body = createMockBody(`channel:C12345:${summary}:10`);
    const result = initialize(body);
    expect(result).toEqual({
      type: "channel",
      channelId: "C12345",
      summary: "テスト要約",
      messageCount: 10,
    });
  });

  it("スレッドタイプの場合に正しいデータを返す", () => {
    const summary = encodeURIComponent("テスト要約");
    const body = createMockBody(`thread:C12345:${summary}:1234567890.123456`);
    const result = initialize(body);
    expect(result).toEqual({
      type: "thread",
      channelId: "C12345",
      summary: "テスト要約",
      threadTs: "1234567890.123456",
    });
  });

  it("不正なタイプの場合にエラーをスローする", () => {
    const summary = encodeURIComponent("テスト要約");
    const body = createMockBody(`invalid:C12345:${summary}`);
    expect(() => initialize(body)).toThrow("不正な要約タイプです");
  });

  it("メッセージ数が指定されていない場合はデフォルト値0を使用する", () => {
    const summary = encodeURIComponent("要約");
    const body = createMockBody(`channel:C12345:${summary}`);
    const result = initialize(body);
    expect(result).toEqual({
      type: "channel",
      channelId: "C12345",
      summary: "要約",
      messageCount: 0,
    });
  });
});
