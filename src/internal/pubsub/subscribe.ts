import amqp from "amqplib";
import { declareAndBind, type SimpleQueueType } from "./publish.js";

export enum Acktype {
  Ack,
  NackDiscard,
  NackRequeue,
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<Acktype>,
) {
  const [channel, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType,
  );

  await channel.consume(
    queue.queue,
    async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) {
        return;
      }

      let data: T;

      try {
        data = JSON.parse(msg.content.toString());
      } catch (err) {
        console.error("Could not unmarshal message:", err);
        return;
      }

      try {
        const result = await handler(data);

        switch (result) {
          case Acktype.Ack:
            channel.ack(msg);
            console.log("ACK");
            break;
          case Acktype.NackDiscard:
            channel.nack(msg, false, false);
            console.log("NACK DISCARD");
            break;
          case Acktype.NackRequeue:
            channel.nack(msg, false, true);
            console.log("NACK REQUEUE");
            break;
          default:
            const unreachable: never = result;
            console.error("Unexpected ack type:", unreachable);
            return;
        }
      } catch (err) {
        console.error("Error handling message:", err);
        channel.nack(msg, false, false);
        return;
      }
    },
  );
}
