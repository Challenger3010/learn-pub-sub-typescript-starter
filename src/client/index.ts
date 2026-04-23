import amqp from "amqplib";
import {
  clientWelcome,
  commandStatus,
  getInput,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { subscribeJSON } from "../internal/pubsub/subscribe.js";
import { handlerPause } from "./handlers.js";

async function main() {
  const rabbitCon = `amqp://guest:guest@localhost:5672/`;
  const conn = await amqp.connect(rabbitCon);

  if (conn) {
    console.log("Connected to RabbitMQ");
  }

  const username = await clientWelcome();

  const [channel, queue] = await declareAndBind(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
  );
  console.log("Starting Peril client...");

  let gs = new GameState(username);

  subscribeJSON(
    conn,
    ExchangePerilDirect,
    `pause.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gs),
  );

  while (true) {
    const inputs = await getInput();
    if (inputs.length === 0) {
      continue;
    }

    let firstWord = inputs[0];

    if (firstWord === "spawn") {
      commandSpawn(gs, inputs);
    } else if (firstWord === "move") {
      const move = commandMove(gs, inputs);
      if (move) {
        console.log("move successful");
      }
    } else if (firstWord === "status") {
      commandStatus(gs);
    } else if (firstWord === "help") {
      printClientHelp();
    } else if (firstWord === "spam") {
      console.log("Spamming is not allowed yet!");
    } else if (firstWord === "quit") {
      printQuit();
      break;
    } else {
      console.log("Error: command not found");
      continue;
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
