import type { ConfirmChannel } from "amqplib";
import type {
  ArmyMove,
  RecognitionOfWar,
} from "../internal/gamelogic/gamedata.js";
import type {
  GameState,
  PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";

import { handlePause } from "../internal/gamelogic/pause.js";
import { AckType } from "../internal/pubsub/subscribe.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import {
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";
import { publishGameLog } from "./index.js";
import { writeLog, type GameLog } from "../internal/gamelogic/logs.js";

export function handlerPause(
  gs: GameState,
): (ps: PlayingState) => Promise<AckType> {
  return async (ps: PlayingState): Promise<AckType> => {
    try {
      handlePause(gs, ps);
      process.stdout.write("> ");
      return AckType.Ack;
    } catch (err) {
      console.error("Error publishing recognition", err);
    } finally {
      return AckType.NackRequeue;
    }
  };
}

export function handlerMove(
  gs: GameState,
  ch: ConfirmChannel,
): (move: ArmyMove) => Promise<AckType> {
  return async (move: ArmyMove) => {
    try {
      const outcome = handleMove(gs, move);
      switch (outcome) {
        case MoveOutcome.Safe:
        case MoveOutcome.SamePlayer:
          return AckType.Ack;

        case MoveOutcome.MakeWar:
          const recognition: RecognitionOfWar = {
            attacker: move.player,
            defender: gs.getPlayerSnap(),
          };
          try {
            await publishJSON(
              ch,
              ExchangePerilTopic,
              `${WarRecognitionsPrefix}.${gs.getUsername()}`,
              recognition,
            );
            return AckType.Ack;
          } catch (err) {
            return AckType.NackRequeue;
          }
        default:
          return AckType.NackDiscard;
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}

export function handlerWar(
  gs: GameState,
  ch: ConfirmChannel,
): (war: RecognitionOfWar) => Promise<AckType> {
  return async (war: RecognitionOfWar) => {
    try {
      const outcome = handleWar(gs, war);
      let msg;

      switch (outcome.result) {
        case WarOutcome.NotInvolved:
          return AckType.NackRequeue;
        case WarOutcome.NoUnits:
          return AckType.NackDiscard;
        case WarOutcome.YouWon:
          try {
            msg = `${war.attacker} won war against ${war.defender}`;
            publishGameLog(ch, gs.getPlayerSnap().username, msg);
            return AckType.Ack;
          } catch {
            return AckType.NackRequeue;
          }
        case WarOutcome.OpponentWon:
          try {
            msg = `${war.defender} won war against ${war.attacker}`;
            await publishGameLog(ch, gs.getPlayerSnap().username, msg);
          } catch {
            return AckType.NackRequeue;
          }
        case WarOutcome.Draw:
          try {
            msg = `${war.attacker} and ${war.attacker} resulted in a draw`;
            await publishGameLog(ch, gs.getPlayerSnap().username, msg);
          } catch {
            return AckType.NackRequeue;
          }
          return AckType.Ack;
        default:
          const unreachable: never = outcome;
          console.log("Unexpected war resolution: ", unreachable);
          return AckType.NackDiscard;
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}

export function handlerLog() {
  return async (gamelog: GameLog): Promise<AckType> => {
    try {
      writeLog(gamelog);
      return AckType.Ack;
    } catch (err) {
      console.error("Error writing log:", err);
      return AckType.NackDiscard;
    } finally {
      process.stdout.write("> ");
    }
  };
}
