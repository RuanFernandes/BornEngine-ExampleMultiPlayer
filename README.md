# BornEngine Multiplayer Example

A small multiplayer portfolio project pairing a native [BornEngine](https://github.com/RuanFernandes/BornEngine) game client with an authoritative [Colyseus](https://colyseus.io/) server. Open two game windows to see both players in the same arena and move them independently.

The repository keeps the two runnable parts together:

```text
BornEngine-ExampleMultiPlayer/
├── MeuGameMultiplayer/    # TypeScript game client compiled by Perry
└── colyseus-test-server/  # Colyseus 0.18 test server and integration checks
```

## Requirements

- Node.js 20.9 or newer
- pnpm
- Perry and the native build prerequisites required by BornEngine

The client in this example has been built and run on Linux. The sample depends on Perry and BornEngine's native platform support; Windows and macOS builds have not been verified in this repository.

## Run the demo

Start the server in the first terminal:

```sh
cd colyseus-test-server
npm ci
npm start
```

Build and launch the game in a second terminal:

```sh
cd MeuGameMultiplayer
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm start
```

Launch another client from a third terminal in `MeuGameMultiplayer/`:

```sh
pnpm start
```

Both clients join the `arena` room at `ws://127.0.0.1:2567`. Use **WASD** or the **arrow keys** to move. Each window labels its local player and displays the shared player positions.

To connect clients on another computer on the same network, change `SERVER_URL` in `MeuGameMultiplayer/main.ts` to the server's reachable WebSocket address.

## What the example demonstrates

- A native BornEngine client written in TypeScript.
- A Colyseus room whose server owns player positions and applies movement input.
- State synchronization for player joins, updates, and departures.
- One `GameObject` per Colyseus session, managed by a `GameScene` and rendered with `SceneNodeComponent`.
- A small adapter patch in `MeuGameMultiplayer/patches/` for delivering native room-join callbacks through the engine's polling loop.
- Automated client-side object synchronization and server-side smoke tests.

The server clamps and normalizes movement input and advances positions on its timestep. Clients send movement intent; they do not authoritatively set their own position.

## Tests

With the server running in another terminal, run the server checks:

```sh
cd colyseus-test-server
npm test
npm run test:multiplayer
```

Run the game-client unit tests with:

```sh
cd MeuGameMultiplayer
pnpm test
```

`npm run test:multiplayer` connects two TypeScript SDK clients to the live `arena` room and checks that both receive server-updated positions.

## Learn more

- [BornEngine](https://github.com/RuanFernandes/BornEngine)
- [Colyseus documentation](https://docs.colyseus.io/)
- [Colyseus native SDK](https://github.com/colyseus/native-sdk)

---

# Exemplo Multiplayer da BornEngine

Projeto de portfólio que junta um cliente de jogo nativo da [BornEngine](https://github.com/RuanFernandes/BornEngine) a um servidor autoritativo [Colyseus](https://colyseus.io/). Abra duas janelas para ver os jogadores na mesma arena e movê-los de forma independente.

## Executar

No primeiro terminal, inicie o servidor:

```sh
cd colyseus-test-server
npm ci
npm start
```

No segundo terminal, instale, teste, compile e execute o jogo:

```sh
cd MeuGameMultiplayer
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm start
```

Abra outro terminal em `MeuGameMultiplayer/` e execute `pnpm start` novamente para abrir o segundo cliente. Os dois entram na sala `arena` em `ws://127.0.0.1:2567`. Use **WASD** ou as **setas** para mover.

O exemplo já foi compilado e executado no Linux. As builds para Windows e macOS ainda não foram verificadas neste repositório; elas dependem do suporte nativo do Perry e da BornEngine para cada plataforma.
