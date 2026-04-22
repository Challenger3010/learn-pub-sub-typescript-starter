import amqp from "amqplib";
import { clientWelcome } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";

async function main() {
  const rabbitCon = `amqp://guest:guest@localhost:5672/`;
  const conn = await amqp.connect(rabbitCon);

  if (conn) {
    console.log("Connected to RabbitMQ");
  }

  const username = await clientWelcome();

  declareAndBind(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
  );

  console.log("Starting Peril client...");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
