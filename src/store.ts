import type { Dispatch, SetStateAction } from "react"
import type { ReactExternalDataSource } from "./useStore";

export function basicStateReducer<S>(state: S, action: SetStateAction<S>): S {
	return typeof action === 'function'
		? (action as Extract<SetStateAction<S>, (...args: unknown[]) => never>)(state)
		: action;
}

export interface Store<S, A> extends ReactExternalDataSource<S, A> {
	dispatch: Dispatch<A>,
}

export function createStore<S>(
	initialState: S,
): Store<S, SetStateAction<S>>;

export function createStore<S, A>(
	initialState: S,
	reducer: (prevState: S, action: A) => S,
): Store<S, A>;

export function createStore<S, A = SetStateAction<S>>(
	initialState: S,
	reducer: (prevState: S, action: A) => S = basicStateReducer as never,
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

	state = initialState

	return store
}
