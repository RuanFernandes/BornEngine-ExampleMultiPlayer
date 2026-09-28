import {
  Colors,
  Game,
  GameObject,
  GameScene,
  Key,
  Mesh,
  SceneNodeComponent,
  ColyseusClient,
} from "@bornengine/engine";
import type { Color, SceneNode } from "@bornengine/engine";
import type { Room } from "@bornengine/engine";
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
const CAMERA = {
  position: { x: 0, y: 10, z: 9 },
  target: { x: 0, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  fovy: 10,
  projection: "orthographic" as const,
};

const PLAYER_COLORS: Color[] = [
  { r: 244, g: 151, b: 75, a: 255 },
  { r: 83, g: 177, b: 247, a: 255 },
  { r: 191, g: 125, b: 241, a: 255 },
  { r: 95, g: 213, b: 164, a: 255 },
  { r: 244, g: 103, b: 129, a: 255 },
  { r: 232, g: 210, b: 91, a: 255 },
];

function createCubeGeometry(): { vertices: number[]; indices: number[] } {
  const faces = [
    { normal: [0, 0, 1], positions: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    { normal: [0, 0, -1], positions: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
    { normal: [1, 0, 0], positions: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    { normal: [-1, 0, 0], positions: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
    { normal: [0, 1, 0], positions: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
    { normal: [0, -1, 0], positions: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
  ];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const face of faces) {
    const baseIndex = vertices.length / 12;
    for (let index = 0; index < face.positions.length; index++) {
      const position = face.positions[index];
      const uv = uvs[index];
      vertices.push(
        position[0], position[1], position[2],
        face.normal[0], face.normal[1], face.normal[2],
        1, 1, 1, 1,
        uv[0], uv[1],
      );
    }
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    indices.push(baseIndex, baseIndex + 2, baseIndex + 3);
  }

  return { vertices, indices };
}

function normalizedColorIndex(value: number): number {
  return Math.abs(Math.round(value)) % PLAYER_COLORS.length;
}

function attachCube(game: Game, cube: Mesh, owner: GameObject, color: Color): SceneNode | null {
  const node = game.sceneGraph.createNode({ name: owner.name });
  if (!node.attachModel(cube) || !node.setColor(color) || !node.setPbr(0.52, 0.12)) {
    game.sceneGraph.remove(node, true);
    return null;
  }

  const adapter = new SceneNodeComponent(node, { ownership: "owned" });
  if (owner.addComponent(adapter) === null) {
    adapter.onDestroy();
    game.sceneGraph.remove(node);
    return null;
  }
  return node;
}

class ArenaFloor extends GameObject {
  constructor(game: Game, cube: Mesh) {
    super({
      name: "Arena floor",
      position: { x: 0, y: -0.22, z: 0 },
      scale: { x: 15, y: 0.35, z: 8.5 },
    });
    attachCube(game, cube, this, { r: 38, g: 47, b: 65, a: 255 });
  }
}

class NetworkPlayer extends GameObject implements PlayerView {
  readonly sessionId: string;
  readonly ready: boolean;
  private readonly visual: SceneNode | null;
  private colorIndex: number;

  constructor(game: Game, cube: Mesh, sessionId: string, snapshot: PlayerSnapshot) {
    super({
      name: snapshot.name,
      position: { x: snapshot.x, y: 0.58, z: snapshot.z },
      scale: { x: 0.62, y: 1.16, z: 0.62 },
    });
    this.sessionId = sessionId;
    this.colorIndex = normalizedColorIndex(snapshot.color);
    this.visual = attachCube(game, cube, this, PLAYER_COLORS[this.colorIndex]);
    this.ready = this.visual !== null;
    if (this.ready) this.applySnapshot(snapshot);
  }

  applySnapshot(snapshot: PlayerSnapshot): void {
    this.name = snapshot.name;
    this.transform.position.x = snapshot.x;
    this.transform.position.y = 0.58;
    this.transform.position.z = snapshot.z;

    const nextColorIndex = normalizedColorIndex(snapshot.color);
    if (nextColorIndex !== this.colorIndex && this.visual !== null) {
      this.visual.setColor(PLAYER_COLORS[nextColorIndex]);
      this.colorIndex = nextColorIndex;
    }
  }
}

function readMovementInput(game: Game): MoveInput {
  let x = 0;
  let z = 0;
  if (game.input.isKeyDown(Key.A) || game.input.isKeyDown(Key.LEFT)) x -= 1;
  if (game.input.isKeyDown(Key.D) || game.input.isKeyDown(Key.RIGHT)) x += 1;
  if (game.input.isKeyDown(Key.W) || game.input.isKeyDown(Key.UP)) z -= 1;
  if (game.input.isKeyDown(Key.S) || game.input.isKeyDown(Key.DOWN)) z += 1;

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

class MultiplayerGame extends Game {
  private readonly world: GameScene;
  private readonly cube: Mesh;
  private readonly client: ColyseusClient;
  private readonly playerViews = new Map<string, NetworkPlayer>();
  private room: Room<ArenaSnapshot> | null = null;
  private snapshot: ArenaSnapshot | null = null;
  private status = "Conectando ao servidor...";
  private lastInput: MoveInput = { x: 9, z: 9 };

  constructor() {
    super({
      window: { width: WIDTH, height: HEIGHT, title: "MeuGame Multiplayer — BornEngine + Colyseus" },
      targetFps: 60,
    });
    this.world = new GameScene(this);
    const cubeGeometry = createCubeGeometry();
    this.cube = new Mesh(this, cubeGeometry.vertices, cubeGeometry.indices);
    this.client = new ColyseusClient(this, SERVER_URL);
  }

  protected override onStart(): void {
    if (this.cube.isLoaded) this.world.add(new ArenaFloor(this, this.cube));

    const playerName = "Player " + (Date.now() % 10_000).toString();
    this.client.joinOrCreateWithCallbacks<ArenaSnapshot>("arena", { name: playerName }, {
      onJoin: (joined) => {
        this.room = joined;
        this.snapshot = joined.state;
        this.status = "Conectado";
        joined.onStateChange((nextState) => { this.snapshot = nextState; });
        joined.onDrop((code, reason) => {
          this.status = "Conexão interrompida (" + code.toString() + "): " + reason;
        });
        joined.onReconnect(() => {
          this.status = "Reconectado";
          this.lastInput = { x: 9, z: 9 };
        });
        joined.onError((error) => { this.status = "Erro: " + error.message; });
        joined.onLeave((code, reason) => {
          this.status = "Saiu da sala (" + code.toString() + "): " + reason;
        });
      },
      onError: (error) => {
        this.status = "Falha ao entrar: " + error.message;
      },
    });
  }

  protected override loop(deltaTime: number): void {
    if (this.room !== null && this.room.isConnected) {
      const input = readMovementInput(this);
      if (!sameInput(input, this.lastInput)) {
        this.room.send("move", input);
        this.lastInput = input;
      }
    }

    if (this.snapshot !== null && this.cube.isLoaded) {
      syncPlayerViews(this.playerViews, this.snapshot.players, (sessionId, player) => {
        const view = new NetworkPlayer(this, this.cube, sessionId, player);
        if (!view.ready || this.world.add(view) === null) {
          view.destroy();
          this.status = "Não foi possível criar o GameObject de " + player.name;
          return null;
        }
        return view;
      });
    }

    this.world.update(deltaTime);
  }

  protected override render(): void {
    this.renderer.clear({ r: 15, g: 20, b: 30, a: 255 });
    this.sceneGraph.setAmbientLight(Colors.WHITE, 0.2);
    this.sceneGraph.addDirectionalLight(
      { x: -0.45, y: -1, z: -0.55 },
      { r: 255, g: 240, b: 209, a: 255 },
      2.8,
    );
    if (this.renderer.begin3D(CAMERA)) this.renderer.end3D();

    const localSessionId = this.room === null ? "" : this.room.sessionId;
    const roomId = this.room === null ? "procurando sala" : this.room.roomId;
    this.renderer.drawText("COLYSEUS ARENA  |  " + this.status, { x: 24, y: 20 }, 18, { r: 245, g: 247, b: 250, a: 255 });
    this.renderer.drawText("Sala: " + roomId, { x: 24, y: 49 }, 14, { r: 175, g: 193, b: 216, a: 255 });
    this.renderer.drawText("WASD / setas: mover   |   Abra duas janelas para ver os dois players", { x: 24, y: 72 }, 14, { r: 175, g: 193, b: 216, a: 255 });
    this.renderer.drawText("Estado autoritativo vindo do servidor (" + SERVER_URL + ")", { x: 24, y: 95 }, 13, { r: 130, g: 150, b: 175, a: 255 });

    if (this.snapshot !== null) {
      const sessionIds = Object.keys(this.snapshot.players);
      this.renderer.drawText("Players conectados: " + sessionIds.length.toString(), { x: 24, y: 132 }, 15, Colors.WHITE);
      for (let index = 0; index < sessionIds.length; index++) {
        const sessionId = sessionIds[index];
        const player = this.snapshot.players[sessionId];
        if (player === undefined) continue;
        const color = PLAYER_COLORS[normalizedColorIndex(player.color)];
        const localMarker = sessionId === localSessionId ? " (voce)" : "";
        const location = "x " + (Math.round(player.x * 10) / 10).toString() +
          "  z " + (Math.round(player.z * 10) / 10).toString();
        this.renderer.drawText(
          player.name + localMarker + "  |  " + location,
          { x: 24, y: 160 + index * 23 },
          14,
          color,
        );
      }
    }
  }

  protected override onStop(): void {
    this.client.dispose();
    this.world.destroy();
    this.cube.dispose();
  }
}

new MultiplayerGame().run();
