import assert from "node:assert/strict";
import test from "node:test";
import {
  syncPlayerViews,
  type PlayerSnapshot,
  type PlayerView,
} from "../src/player-sync.ts";

class TestPlayerView implements PlayerView {
  snapshots: PlayerSnapshot[] = [];
  destroyed = false;

  applySnapshot(snapshot: PlayerSnapshot): void {
    this.snapshots.push({ ...snapshot });
  }

  destroy(): void {
    this.destroyed = true;
  }
}

function createPlayer(x: number, name: string = "Player"): PlayerSnapshot {
  return { name, x, z: 0, color: 0 };
}

test("creates one view per session and updates it from later snapshots", () => {
  const views = new Map<string, TestPlayerView>();
  const createdIds: string[] = [];
  const createView = (sessionId: string): TestPlayerView => {
    createdIds.push(sessionId);
    return new TestPlayerView();
  };

  syncPlayerViews(views, { alpha: createPlayer(-1) }, createView);
  const firstView = views.get("alpha");
  assert.ok(firstView);

  syncPlayerViews(
    views,
    { alpha: createPlayer(2, "Updated"), beta: createPlayer(4) },
    createView,
  );

  assert.equal(views.get("alpha"), firstView);
  assert.deepEqual(firstView.snapshots, [createPlayer(-1), createPlayer(2, "Updated")]);
  assert.deepEqual(createdIds, ["alpha", "beta"]);
});

test("destroys views when their session disappears from room state", () => {
  const views = new Map<string, TestPlayerView>();
  const createView = (): TestPlayerView => new TestPlayerView();
  syncPlayerViews(views, { alpha: createPlayer(-1), beta: createPlayer(1) }, createView);
  const departed = views.get("alpha");
  assert.ok(departed);

  syncPlayerViews(views, { beta: createPlayer(3) }, createView);

  assert.equal(views.has("alpha"), false);
  assert.equal(departed.destroyed, true);
  assert.equal(views.has("beta"), true);
});
