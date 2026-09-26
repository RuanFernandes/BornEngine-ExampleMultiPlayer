import { defineRoom, defineServer } from "colyseus";
import { ArenaRoom } from "./rooms/ArenaRoom.js";
import { TestRoom } from "./rooms/TestRoom.js";

const server = defineServer({
  rooms: {
    arena: defineRoom(ArenaRoom),
    test_room: defineRoom(TestRoom),
  },
});

export default server;
