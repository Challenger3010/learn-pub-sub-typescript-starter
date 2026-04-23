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
import { Acktype } from "../internal/pubsub/subscribe.js";
import { publishJSON } from "../internal/pubsub/publish.js";
import {
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";

export function handlerPause(
  gs: GameState,
): (ps: PlayingState) => Promise<Acktype> {
  return async (ps: PlayingState): Promise<Acktype> => {
    try {
      handlePause(gs, ps);
      process.stdout.write("> ");
      return Acktype.Ack;
    } catch (err) {
      console.error("Error publishing recognition", err);
    } finally {
      return Acktype.NackRequeue;
    }
  };
}

export function handlerMove(
  gs: GameState,
  ch: ConfirmChannel,
): (move: ArmyMove) => Promise<Acktype> {
  return async (move: ArmyMove) => {
    try {
      const outcome = handleMove(gs, move);
      switch (outcome) {
        case MoveOutcome.Safe:
        case MoveOutcome.SamePlayer:
          return Acktype.Ack;

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
            return Acktype.Ack;
          } catch (err) {
            return Acktype.NackRequeue;
          }
        default:
          return Acktype.NackDiscard;
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}

export function handlerWar(
  gs: GameState,
): (war: RecognitionOfWar) => Promise<Acktype> {
  return async (war: RecognitionOfWar) => {
    try {
      const outcome = handleWar(gs, war);

      switch (outcome.result) {
        case WarOutcome.NotInvolved:
          return Acktype.NackRequeue;
        case WarOutcome.NoUnits:
          return Acktype.NackDiscard;
        case WarOutcome.YouWon:
        case WarOutcome.OpponentWon:
        case WarOutcome.Draw:
          return Acktype.Ack;
        default:
          const unreachable: never = outcome;
          console.log("Unexpected war resolution: ", unreachable);
          return Acktype.NackDiscard;
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}
