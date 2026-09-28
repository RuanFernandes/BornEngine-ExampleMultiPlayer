# MeuGame Multiplayer

Demo nativa para testar a API class-first da BornEngine com uma sala Colyseus autoritativa. `Game` é dono do renderer, input, cena, malha e cliente de rede. Cada jogador é um `GameObject` sincronizado com um `SceneNodeComponent`; os snapshots da sala criam, atualizam e removem esses objetos usando o `sessionId` como chave. O servidor recebe somente a direção do movimento e controla as posições.

`MultiplayerGame` estende `Game`: `onStart()` conecta à sala, `loop(deltaTime)` envia movimento e atualiza a cena, `render()` desenha o estado e `onStop()` libera os recursos do jogo. A engine cuida do ciclo de frames e descarta o runtime depois de `onStop()`.

O projeto é separado do `MeuGame/` para preservar as alterações locais desse jogo.

O projeto usa `@bornengine/engine` `^0.7.0`, que fornece a API class-first e os hooks de ciclo de vida mostrados no demo.

## Requisitos

- Node.js 20.9 ou mais recente
- pnpm
- Perry instalado e configurado para compilar projetos BornEngine

## Iniciar

Na raiz deste repositório, em um terminal, inicie o servidor local:

```sh
cd colyseus-test-server
npm install
npm start
```

Em outro terminal, instale e execute o jogo:

```sh
cd MeuGameMultiplayer
pnpm install
pnpm test
pnpm build
pnpm start
```

Abra uma segunda janela do jogo com `pnpm start`. Os dois clientes entram na sala `arena`; mova cada jogador com WASD ou as setas e acompanhe os nomes e posições sincronizados no HUD.

O teste de integração do servidor pode ser executado separadamente, com o servidor ativo:

```sh
cd colyseus-test-server
npm run test:multiplayer
```

Por padrão, o cliente conecta em `ws://127.0.0.1:2567`. Para testar em outro computador ou celular na mesma rede, ajuste `SERVER_URL` em `main.ts` para o endereço acessível do servidor.
