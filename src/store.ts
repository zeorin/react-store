import type { Dispatch, SetStateAction } from "react"

export function basicStateReducer<S>(state: S, action: SetStateAction<S>): S {
  return typeof action === 'function' ? (action as Extract<SetStateAction<S>, (...args: unknown[]) => never>)(state) : action;
}

export interface Store<S, A> {
  dispatch: Dispatch<A>,
  reducer: (prevState: S, action: A) => S,
  getState: () => S
  subscribe: (listener: (action: A) => void) => () => void
}

export function createStore<S, A>(
	reducer: (prevState: S, action: A) => S,
	initialState: S,
): Store<S, A>;

export function createStore<S, I, A>(
	reducer: (prevState: S, action: A) => S,
	initialArg: I,
	init: (i: I) => S,
): Store<S, A>;

export function createStore<S, I, A>(
	reducer: (prevState: S, action: A) => S,
	initialArg: I | S,
	init?: (i: I) => S,
) {
  let state: S
  const listeners: Set<(action: A) => void> = new Set()

  const dispatch: Store<S, A>['dispatch'] = (action) => {
    const nextState = reducer(state, action)
    if (!Object.is(nextState, state)) {
      state = nextState
      listeners.forEach((listener) => listener(action))
    }
  }

  const getState: Store<S, A>['getState'] = () => state

  const subscribe: Store<S, A>['subscribe'] = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const store: Store<S, A> = { dispatch, getState, reducer, subscribe }

  state = typeof init === 'function' ? init(initialArg as I) : (initialArg as S)

  return store
}
