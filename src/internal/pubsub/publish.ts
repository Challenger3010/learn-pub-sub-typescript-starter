import { encode } from "@msgpack/msgpack";
import type { ConfirmChannel } from "amqplib";
import amqp from "amqplib";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export async function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const jsonBytes = JSON.stringify(value);
  const bytes = Buffer.from(jsonBytes);

  ch.publish(
    exchange,
    routingKey,
    bytes,
    {
      contentType: "application/json",
    },
    (err, ok) => {
      if (err) {
        throw new Error(`Error in publish ${err}`);
      }
    },
  );
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[amqp.Channel, amqp.Replies.AssertQueue]> {
  const channel = await conn.createChannel();

  let queue: amqp.Replies.AssertQueue;

  if (queueType === SimpleQueueType.Transient) {
    queue = await channel.assertQueue(queueName, {
      durable: false,
      autoDelete: true,
      exclusive: true,
      arguments: {
        "x-dead-letter-exchange": "peril_dlx",
      },
    });
  } else {
    queue = await channel.assertQueue(queueName, {
      durable: true,
    });
  }

  await channel.bindQueue(queue.queue, exchange, key);

  return [channel, queue];
}

export async function publishMsgPack<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const encoded = encode(value);
  const bytes = Buffer.from(encoded.buffer);

  ch.publish(exchange, routingKey, bytes, {
    contentType: "application/x-msgpack",
  });
}
