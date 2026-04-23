import amqp from "amqplib";
import { declareAndBind, type SimpleQueueType } from "./publish.js";

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => void,
) {
  const [channel, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType,
  );

  channel.consume(queue.queue, (msg: amqp.ConsumeMessage | null) => {
    if (!msg) {
      return;
    }

    const parsedMsg = JSON.parse(msg.content.toString());

    handler(parsedMsg);
    channel.ack(msg);
  });
}
