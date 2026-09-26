import assert from "node:assert/strict";
import test from "node:test";
import type { Game } from "@bornengine/engine";
import { ColyseusClient } from "@bornengine/engine/colyseus";
import { bindGameContext, GameContext } from "../node_modules/@bornengine/engine/src/core/context.ts";

test("delivers a native room join synchronously from client polling", () => {
  const events: string[] = [];
  const native = globalThis as unknown as Record<string, (...args: any[]) => any>;
  const previous = new Map<string, ((...args: any[]) => any) | undefined>();
  const stub = (name: string, implementation: (...args: any[]) => any): void => {
    previous.set(name, native[name]);
    native[name] = implementation;
  };
  stub("bloom_colyseus_client_create", () => 101);
  stub("bloom_colyseus_client_join", () => 202);
  stub("bloom_colyseus_client_dispose", () => {});
  stub("bloom_colyseus_poll", () => {});
  stub("bloom_colyseus_next_event", () => events.shift() ?? "");
  stub("bloom_colyseus_room_is_connected", () => 1);
  stub("bloom_colyseus_room_is_reconnecting", () => 0);

  const game = {} as Game;
  const context = GameContext.create();
  assert.ok(context);
  context.markReady();
  bindGameContext(game, context);
  const client = new ColyseusClient(game, "ws://127.0.0.1:2567");
  let joinedRoom: { roomId: string; sessionId: string; isConnected: boolean } | null = null;
  let joinError: Error | null = null;

  try {
    assert.equal(client.isLoaded, true);
    assert.equal(client.joinOrCreateWithCallbacks("arena", { name: "Player" }, {
      onJoin: (room) => { joinedRoom = room; },
      onError: (error) => { joinError = error; },
    }), true);

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
    context.dispose();
    for (const [name, implementation] of previous) {
      if (implementation === undefined) delete native[name];
      else native[name] = implementation;
    }
  }
});
