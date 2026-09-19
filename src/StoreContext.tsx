import { createContext, type SetStateAction } from "react";
import type { State } from "./App";
import type { Store } from "./store";

export const StoreContext = createContext<Store<State, SetStateAction<State>> | null>(null)
StoreContext.displayName = "StoreContext"
