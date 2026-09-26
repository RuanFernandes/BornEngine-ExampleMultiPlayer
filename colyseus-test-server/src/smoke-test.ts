import { Client } from "@colyseus/sdk";

const client = new Client(process.env.COLYSEUS_URL ?? "ws://127.0.0.1:2567");
const room = await client.joinOrCreate("test_room", { name: "BornEngine smoke test" });

const timeout = setTimeout(() => {
  console.error("Colyseus smoke test timed out");
  void room.leave();
  process.exitCode = 1;
}, 10_000);

let sawInitialState = false;
let sawIncrement = false;

room.onMessage("joined", () => {});
room.onStateChange((state: any) => {
  if (state?.counter === 0 && state?.players?.size >= 1) sawInitialState = true;
  if (state?.counter === 3) sawIncrement = true;
  finishIfReady();
});

room.onMessage("incremented", (message: { counter?: number }) => {
  if (message.counter === 3) sawIncrement = true;
  finishIfReady();
});

room.send("increment", { amount: 3 });

function finishIfReady() {
  if (!sawInitialState || !sawIncrement) return;
  clearTimeout(timeout);
  void room.leave().then(() => {
    console.log("Colyseus server smoke test passed");
  });
}
