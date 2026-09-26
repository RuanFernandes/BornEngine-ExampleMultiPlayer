# Colyseus integration test server

Small local server used by BornEngine's Colyseus SDK integration checks and the `MeuGameMultiplayer` sample. It exposes `test_room` for SDK smoke tests and an `arena` room for a two-client multiplayer demo.

## Run

```sh
npm install
npm start
```

The server listens on port `2567` by default; set `PORT` to change it.

Run `npm test` to check the existing SDK smoke room. Run `npm run test:multiplayer` in another terminal to join `arena` with two official TypeScript SDK clients, send movement input, and verify that both clients receive server-updated positions.

The `arena` room owns player positions, clamps and normalizes input, advances movement on the server timestep, and holds dropped seats for up to 15 seconds for reconnection. `MeuGameMultiplayer` connects to this room and renders each session as an OOP game object.

The fixture follows the official Colyseus client, state synchronization, and reconnection flows:

- https://docs.colyseus.io/sdk
- https://docs.colyseus.io/state
- https://docs.colyseus.io/sdk/connection
