import assert from "node:assert/strict";
import { Client } from "@colyseus/sdk";

interface PlayerState {
  name: string;
  x: number;
  z: number;
}

interface ArenaState {
  players: Map<string, PlayerState>;
}

const endpoint = process.env.COLYSEUS_URL ?? "ws://127.0.0.1:2567";
const firstClient = new Client(endpoint);
const secondClient = new Client(endpoint);
let firstRoom: any = null;
let secondRoom: any = null;

function findPlayer(room: any, sessionId: string): PlayerState | undefined {
  return (room?.state as ArenaState | null)?.players?.get(sessionId);
}

async function waitFor(description: string, condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

try {
  firstRoom = await firstClient.joinOrCreate<ArenaState>("arena", { name: "Player One" });
  secondRoom = await secondClient.joinOrCreate<ArenaState>("arena", { name: "Player Two" });

  assert.equal(secondRoom.roomId, firstRoom.roomId, "both clients should join the same arena");
  await waitFor("both players in the shared room state", () =>
    findPlayer(firstRoom, firstRoom.sessionId) !== undefined &&
    findPlayer(firstRoom, secondRoom.sessionId) !== undefined &&
    findPlayer(secondRoom, firstRoom.sessionId) !== undefined &&
    findPlayer(secondRoom, secondRoom.sessionId) !== undefined,
  );

  const initialX = findPlayer(firstRoom, firstRoom.sessionId)!.x;
  firstRoom.send("move", { x: 1, z: 0 });
  await waitFor("authoritative movement replicated to both clients", () => {
    const firstView = findPlayer(firstRoom, firstRoom.sessionId);
    const secondView = findPlayer(secondRoom, firstRoom.sessionId);
    return firstView !== undefined && secondView !== undefined &&
      firstView.x > initialX + 0.05 && secondView.x > initialX + 0.05;
  });

  console.log("Colyseus multiplayer smoke test passed: two clients shared an arena and server state.");
} catch (error) {
  console.error("Colyseus multiplayer smoke test failed:", error);
  process.exitCode = 1;
} finally {
  await Promise.all([
    firstRoom?.leave(),
    secondRoom?.leave(),
  ].filter(Boolean));
}
