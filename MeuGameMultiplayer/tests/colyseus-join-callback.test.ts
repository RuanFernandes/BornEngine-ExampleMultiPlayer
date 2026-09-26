import assert from "node:assert/strict";
import test from "node:test";
import { ColyseusClient } from "@bornengine/engine/colyseus";

test("delivers a native room join synchronously from client polling", () => {
  const events: string[] = [];
  const native = globalThis as unknown as Record<string, (...args: any[]) => any>;
  native.bloom_colyseus_client_create = () => 101;
  native.bloom_colyseus_client_join = () => 202;
  native.bloom_colyseus_client_dispose = () => {};
  native.bloom_colyseus_poll = () => {};
  native.bloom_colyseus_next_event = () => events.shift() ?? "";
  native.bloom_colyseus_room_is_connected = () => 1;
  native.bloom_colyseus_room_is_reconnecting = () => 0;

  const client = new ColyseusClient("ws://127.0.0.1:2567");
  let joinedRoom: { roomId: string; sessionId: string; isConnected: boolean } | null = null;
  let joinError: Error | null = null;

  try {
    const callbackClient = client as ColyseusClient & {
      joinOrCreateWithCallbacks<TState>(
        roomName: string,
        options: object,
        callbacks: {
          onJoin(room: { roomId: string; sessionId: string; isConnected: boolean }): void;
          onError(error: Error): void;
        },
      ): void;
    };
    callbackClient.joinOrCreateWithCallbacks("arena", { name: "Player" }, {
      onJoin: (room) => { joinedRoom = room; },
      onError: (error) => { joinError = error; },
    });

    assert.equal(joinedRoom, null, "join callback waits for a native join event");
    events.push(JSON.stringify({
      kind: "join",
      room: 202,
      roomId: "arena-1",
      sessionId: "session-1",
      reconnectionToken: "token-1",
    }));
    client.poll();

    assert.equal(joinError, null);
    assert.ok(joinedRoom);
    assert.equal(joinedRoom.roomId, "arena-1");
    assert.equal(joinedRoom.sessionId, "session-1");
    assert.equal(joinedRoom.isConnected, true);
  } finally {
    client.dispose();
  }
});
