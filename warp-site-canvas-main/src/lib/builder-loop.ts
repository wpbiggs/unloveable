export type LoopState =
  | "IDLE"
  | "PLANNING"
  | "PATCHING"
  | "RUNNING"
  | "OBSERVING"
  | "REPAIRING"
  | "DONE"
  | "STOPPED"
  | "ERROR";

export type LoopContext = {
  state: LoopState;
  iteration: number;
  lastError: string | null;
  lastRunLog: string | null;
};

export type LoopAction =
  | { type: "RESET" }
  | { type: "START_ITERATION" }
  | { type: "SET_STATE"; state: LoopState }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_RUN_LOG"; log: string | null };

export function loopReducer(state: LoopContext, action: LoopAction): LoopContext {
  switch (action.type) {
    case "RESET":
      return { state: "IDLE", iteration: 0, lastError: null, lastRunLog: null };
    case "START_ITERATION":
      return { ...state, iteration: state.iteration + 1, lastError: null };
    case "SET_STATE":
      return { ...state, state: action.state };
    case "SET_ERROR":
      return { ...state, lastError: action.error };
    case "SET_RUN_LOG":
      return { ...state, lastRunLog: action.log };
    default:
      return state;
  }
}

export function loopIsBusy(s: LoopState) {
  return s === "PLANNING" || s === "PATCHING" || s === "RUNNING" || s === "OBSERVING" || s === "REPAIRING";
}
