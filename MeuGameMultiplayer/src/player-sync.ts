export interface PlayerSnapshot {
  name: string;
  x: number;
  z: number;
  color: number;
}

export interface PlayerView {
  applySnapshot(snapshot: PlayerSnapshot): void;
  destroy(): void;
}

/** Keeps one local game object for each server-owned Colyseus session. */
export function syncPlayerViews<View extends PlayerView>(
  views: Map<string, View>,
  players: Record<string, PlayerSnapshot>,
  createView: (sessionId: string, snapshot: PlayerSnapshot) => View | null,
): void {
  const liveSessionIds = Object.keys(players);

  for (let index = 0; index < liveSessionIds.length; index++) {
    const sessionId = liveSessionIds[index];
    const snapshot = players[sessionId];
    if (snapshot === undefined) continue;

    let view = views.get(sessionId);
    if (view === undefined) {
      view = createView(sessionId, snapshot) ?? undefined;
      if (view === undefined) continue;
      views.set(sessionId, view);
    }
    view.applySnapshot(snapshot);
  }

  for (const [sessionId, view] of views) {
    if (liveSessionIds.indexOf(sessionId) >= 0) continue;
    view.destroy();
    views.delete(sessionId);
  }
}
