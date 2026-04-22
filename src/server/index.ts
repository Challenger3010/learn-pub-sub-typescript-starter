import amqp from "amqplib";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";

async function main() {
  const rabbitCon = `amqp://guest:guest@localhost:5672/`;
  const conn = await amqp.connect(rabbitCon);

  if (conn) {
    console.log("connection build successfully");
  }

  const confChannel = await conn.createConfirmChannel();
  const state: PlayingState = {
    isPaused: true,
  };

  // await publishJSON(confChannel, ExchangePerilDirect, PauseKey, state);

  console.log("Starting Peril server...");

  printServerHelp();

  while (true) {
    const inputs = await getInput();
    if (inputs.length === 0) {
      continue;
    } else if (inputs[0] === "pause") {
      console.log("Sending a pause message");
      await publishJSON(confChannel, ExchangePerilDirect, PauseKey, state);
    } else if (inputs[0] === "resume") {
      console.log("Sending a resume message");
      await publishJSON(confChannel, ExchangePerilDirect, PauseKey, {
        isPaused: false,
      });
    } else if (inputs[0] === "quit") {
      console.log("Quitting");
      break;
    } else {
      console.log("Dindn't understood the command");
      continue;
    }
  }

  process.on("SIGINT", (code) => {
    console.log("Shuting down");
    console.log("Process exit event with code", code);
    conn.close();
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
