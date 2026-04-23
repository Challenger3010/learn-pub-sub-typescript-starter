import { decode } from "@msgpack/msgpack";
import amqp, { type Channel } from "amqplib";
import { declareAndBind } from "./publish.js";

export enum AckType {
  Ack,
  NackDiscard,
  NackRequeue,
}

export enum SimpleQueueType {
  Durable,
  Transient,
}

export async function subscribe<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
  unmarshaller: (data: Buffer) => T,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    routingKey,
    queueType,
  );

  await ch.prefetch(1);

  await ch.consume(
    queue.queue,
    async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;

      let data: T;
      try {
        data = unmarshaller(msg.content);
      } catch (err) {
        console.error("Could not decode message:", err);
        return;
      }

      try {
        const result = await handler(data);
        switch (result) {
          case AckType.Ack:
            ch.ack(msg);
            break;
          case AckType.NackDiscard:
            ch.nack(msg, false, false);
            break;
          case AckType.NackRequeue:
            ch.nack(msg, false, true);
            break;
          default:
            const unreachable: never = result;
            console.error("Unexpected ack type:", unreachable);
        }
      } catch (err) {
        console.error("Error in handler:", err);
        ch.nack(msg, false, false);
      }
    },
    { noAck: false },
  );
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  return subscribe(conn, exchange, queueName, key, queueType, handler, (data) =>
    JSON.parse(data.toString()),
  );
}

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  return subscribe(
    conn,
    exchange,
    queueName,
    key,
    queueType,
    handler,
    (data) => decode(data) as T,
  );
}
