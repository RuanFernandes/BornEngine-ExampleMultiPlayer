import { Room, type Client } from "@colyseus/core";
import { MapSchema, Schema, type } from "@colyseus/schema";

interface MoveInput {
  x: number;
  z: number;
}

class ArenaPlayer extends Schema {
  @type("string") name = "Player";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") color = 0;
}

class ArenaState extends Schema {
  @type({ map: ArenaPlayer }) players = new MapSchema<ArenaPlayer>();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readAxis(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, -1, 1)
    : 0;
}

export class ArenaRoom extends Room {
  maxClients = 8;
  state = new ArenaState();
  private inputs = new Map<string, MoveInput>();

  messages = {
    move: (client: Client, payload: { x?: unknown; z?: unknown }) => {
      let x = readAxis(payload?.x);
      let z = readAxis(payload?.z);
      const magnitude = Math.sqrt(x * x + z * z);
      if (magnitude > 1) {
        x /= magnitude;
        z /= magnitude;
      }
      this.inputs.set(client.sessionId, { x, z });
    },
  };

  onCreate(): void {
    this.setTimestep((deltaMs) => {
      const seconds = Math.min(Math.max(deltaMs, 0), 50) / 1000;
      for (const [sessionId, input] of this.inputs) {
        const player = this.state.players.get(sessionId);
        if (player === undefined) continue;
        player.x = clamp(player.x + input.x * 3.5 * seconds, -7, 7);
        player.z = clamp(player.z + input.z * 3.5 * seconds, -4, 4);
      }
    });
  }

  onJoin(client: Client, options: { name?: string } = {}): void {
    const index = this.state.players.size;
    const player = new ArenaPlayer();
    const suppliedName = typeof options.name === "string" ? options.name.trim() : "";
    player.name = suppliedName.length > 0 ? suppliedName.slice(0, 20) : `Player ${index + 1}`;
    player.x = -3.5 + (index % 8) * 1;
    player.z = index % 2 === 0 ? -0.5 : 0.5;
    player.color = index % 6;
    this.state.players.set(client.sessionId, player);
    this.inputs.set(client.sessionId, { x: 0, z: 0 });
  }

  async onDrop(client: Client): Promise<void> {
    this.inputs.set(client.sessionId, { x: 0, z: 0 });
    const player = this.state.players.get(client.sessionId);
    if (player !== undefined && !player.name.endsWith(" (reconnecting)")) {
      player.name += " (reconnecting)";
    }
    await this.allowReconnection(client, 15);
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player !== undefined) player.name = player.name.replace(" (reconnecting)", "");
    this.inputs.set(client.sessionId, { x: 0, z: 0 });
  }

  onLeave(client: Client): void {
    this.inputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }
}
