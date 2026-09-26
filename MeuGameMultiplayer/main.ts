import {
  beginMode3D,
  clearBackground,
  closeWindow,
  endMode3D,
  initWindow,
  isKeyDown,
  Key,
  runGame,
  setTaaEnabled,
  setTargetFPS,
} from "@bornengine/engine/core";
import type { Camera3D, Color, Model } from "@bornengine/engine/core";
import { ColyseusClient, type Room as ColyseusRoom } from "@bornengine/engine/colyseus";
import { GameObject, GameScene, SceneNodeComponent } from "@bornengine/engine/game";
import {
  addDirectionalLight,
  attachModelToNode,
  createSceneNode,
  setSceneNodeColor,
  setSceneNodePbr,
} from "@bornengine/engine/scene";
import { genMeshCube, unloadModel } from "@bornengine/engine/models";
import { drawTextRgba } from "@bornengine/engine/text";
import {
  syncPlayerViews,
  type PlayerSnapshot,
  type PlayerView,
} from "./src/player-sync";

interface ArenaSnapshot {
  players: Record<string, PlayerSnapshot>;
}

interface MoveInput {
  x: number;
  z: number;
}

const WIDTH = 960;
const HEIGHT = 640;
const SERVER_URL = "ws://127.0.0.1:2567";
const CAMERA: Camera3D = {
  position: { x: 0, y: 10, z: 9 },
  target: { x: 0, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  fovy: 10,
  projection: "orthographic",
};

const PLAYER_COLORS: Color[] = [
  { r: 244, g: 151, b: 75, a: 255 },
  { r: 83, g: 177, b: 247, a: 255 },
  { r: 191, g: 125, b: 241, a: 255 },
  { r: 95, g: 213, b: 164, a: 255 },
  { r: 244, g: 103, b: 129, a: 255 },
  { r: 232, g: 210, b: 91, a: 255 },
];

function normalizedColorIndex(value: number): number {
  const index = Math.abs(Math.round(value)) % PLAYER_COLORS.length;
  return index;
}

function addCubeRenderer(owner: GameObject, model: Model, color: Color): boolean {
  const handle = createSceneNode();
  if (handle === 0) return false;

  attachModelToNode(handle, model.handle, 0);
  setSceneNodeColor(handle, color.r, color.g, color.b, color.a);
  setSceneNodePbr(handle, 0.52, 0.12);

  const adapter = new SceneNodeComponent(handle, { ownership: "owned" });
  if (owner.addComponent(adapter) === null) {
    adapter.onDestroy();
    return false;
  }
  return true;
}

class ArenaFloor extends GameObject {
  constructor(model: Model) {
    super({
      name: "Arena floor",
      position: { x: 0, y: -0.22, z: 0 },
      scale: { x: 15, y: 0.35, z: 8.5 },
    });
    addCubeRenderer(this, model, { r: 38, g: 47, b: 65, a: 255 });
  }
}

class NetworkPlayer extends GameObject implements PlayerView {
  readonly sessionId: string;
  readonly ready: boolean;
  private readonly nodeHandle: number;
  private colorIndex: number;

  constructor(sessionId: string, model: Model, snapshot: PlayerSnapshot) {
    super({
      name: snapshot.name,
      position: { x: snapshot.x, y: 0.58, z: snapshot.z },
      scale: { x: 0.62, y: 1.16, z: 0.62 },
    });
    this.sessionId = sessionId;
    this.colorIndex = normalizedColorIndex(snapshot.color);
    this.nodeHandle = createSceneNode();
    this.ready = this.nodeHandle !== 0 &&
      addCubeRendererForHandle(this, model, this.nodeHandle, PLAYER_COLORS[this.colorIndex]);
    if (this.ready) this.applySnapshot(snapshot);
  }

  applySnapshot(snapshot: PlayerSnapshot): void {
    this.name = snapshot.name;
    this.transform.position.x = snapshot.x;
    this.transform.position.y = 0.58;
    this.transform.position.z = snapshot.z;

    const nextColorIndex = normalizedColorIndex(snapshot.color);
    if (nextColorIndex !== this.colorIndex && this.nodeHandle !== 0) {
      const color = PLAYER_COLORS[nextColorIndex];
      setSceneNodeColor(this.nodeHandle, color.r, color.g, color.b, color.a);
      this.colorIndex = nextColorIndex;
    }
  }
}

function addCubeRendererForHandle(
  owner: GameObject,
  model: Model,
  handle: number,
  color: Color,
): boolean {
  attachModelToNode(handle, model.handle, 0);
  setSceneNodeColor(handle, color.r, color.g, color.b, color.a);
  setSceneNodePbr(handle, 0.42, 0.18);

  const adapter = new SceneNodeComponent(handle, { ownership: "owned" });
  if (owner.addComponent(adapter) === null) {
    adapter.onDestroy();
    return false;
  }
  return true;
}

function readMovementInput(): MoveInput {
  let x = 0;
  let z = 0;
  if (isKeyDown(Key.A) || isKeyDown(Key.LEFT)) x -= 1;
  if (isKeyDown(Key.D) || isKeyDown(Key.RIGHT)) x += 1;
  if (isKeyDown(Key.W) || isKeyDown(Key.UP)) z -= 1;
  if (isKeyDown(Key.S) || isKeyDown(Key.DOWN)) z += 1;

  const magnitude = Math.sqrt(x * x + z * z);
  if (magnitude > 1) {
    x /= magnitude;
    z /= magnitude;
  }
  return { x, z };
}

function sameInput(first: MoveInput, second: MoveInput): boolean {
  return first.x === second.x && first.z === second.z;
}

initWindow(WIDTH, HEIGHT, "MeuGame Multiplayer - BornEngine + Colyseus");
setTaaEnabled(false);
setTargetFPS(60);

const world = new GameScene();
const cube = genMeshCube(1, 1, 1);
if (cube.handle !== 0) {
  world.add(new ArenaFloor(cube));
}

const playerViews = new Map<string, NetworkPlayer>();
const client = new ColyseusClient(SERVER_URL);
let room: ColyseusRoom<ArenaSnapshot> | null = null;
let snapshot: ArenaSnapshot | null = null;
let status = "Conectando ao servidor...";
let lastInput: MoveInput = { x: 9, z: 9 };

const playerName = "Player " + (Date.now() % 10_000).toString();
client.joinOrCreateWithCallbacks<ArenaSnapshot>("arena", { name: playerName }, {
  onJoin: (joined) => {
    room = joined;
    snapshot = joined.state;
    status = "Conectado";
    joined.onStateChange((nextState) => { snapshot = nextState; });
    joined.onDrop((code, reason) => {
      status = "Conexão interrompida (" + code.toString() + "): " + reason;
    });
    joined.onReconnect(() => {
      status = "Reconectado";
      lastInput = { x: 9, z: 9 };
    });
    joined.onError((error) => { status = "Erro: " + error.message; });
    joined.onLeave((code, reason) => {
      status = "Saiu da sala (" + code.toString() + "): " + reason;
    });
  },
  onError: (error) => { status = "Falha ao entrar: " + error.message; },
});

runGame((dt: number): void => {
  if (room !== null && room.isConnected) {
    const input = readMovementInput();
    if (!sameInput(input, lastInput)) {
      room.send("move", input);
      lastInput = input;
    }
  }

  if (snapshot !== null && cube.handle !== 0) {
    syncPlayerViews(playerViews, snapshot.players, (sessionId, player) => {
      const view = new NetworkPlayer(sessionId, cube, player);
      if (!view.ready || world.add(view) === null) {
        view.destroy();
        status = "Não foi possível criar o GameObject de " + player.name;
        return null;
      }
      return view;
    });
  }

  world.update(dt);
  clearBackground({ r: 15, g: 20, b: 30, a: 255 });
  addDirectionalLight(-0.45, -1, -0.55, 1, 0.94, 0.82, 2.8);
  beginMode3D(CAMERA);
  endMode3D();

  const localSessionId = room === null ? "" : room.sessionId;
  const roomId = room === null ? "procurando sala" : room.roomId;
  drawTextRgba("COLYSEUS ARENA  |  " + status, 24, 20, 18, 245, 247, 250, 255);
  drawTextRgba("Sala: " + roomId, 24, 49, 14, 175, 193, 216, 255);
  drawTextRgba("WASD / setas: mover   |   Abra duas janelas para ver os dois players", 24, 72, 14, 175, 193, 216, 255);
  drawTextRgba("Estado autoritativo vindo do servidor (" + SERVER_URL + ")", 24, 95, 13, 130, 150, 175, 255);

  if (snapshot !== null) {
    const sessionIds = Object.keys(snapshot.players);
    drawTextRgba("Players conectados: " + sessionIds.length.toString(), 24, 132, 15, 245, 247, 250, 255);
    for (let index = 0; index < sessionIds.length; index++) {
      const sessionId = sessionIds[index];
      const player = snapshot.players[sessionId];
      if (player === undefined) continue;
      const color = PLAYER_COLORS[normalizedColorIndex(player.color)];
      const localMarker = sessionId === localSessionId ? " (voce)" : "";
      const location = "x " + (Math.round(player.x * 10) / 10).toString() +
        "  z " + (Math.round(player.z * 10) / 10).toString();
      drawTextRgba(
        player.name + localMarker + "  |  " + location,
        24,
        160 + index * 23,
        14,
        color.r,
        color.g,
        color.b,
        color.a,
      );
    }
  }
});

client.dispose();
world.destroy();
if (cube.handle !== 0) unloadModel(cube);
closeWindow();
