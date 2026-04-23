import type { ArmyMove } from "../internal/gamelogic/gamedata.js";
import type {
  GameState,
  PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";

import { handlePause } from "../internal/gamelogic/pause.js";
import { Acktype } from "../internal/pubsub/subscribe.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => Acktype {
  return (ps: PlayingState): Acktype => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return Acktype.Ack;
  };
}

export function handlerMove(gs: GameState): (move: ArmyMove) => Acktype {
  return (move: ArmyMove) => {
    try {
      const outcome = handleMove(gs, move);
      switch (outcome) {
        case MoveOutcome.Safe:
        case MoveOutcome.MakeWar:
          return Acktype.Ack;
        default:
          return Acktype.NackDiscard;
      }
    } finally {
      process.stdout.write("> ");
    }
  };
}
