import {
	useEffect,
	useReducer,
	useState,
} from "react";

export interface ReactExternalDataSource<S, A> {
	/** Get the current state of the store. State must be immutable. */
	getState(): S,
	/** The stable reducer function used by the store to produce new states.
	 *  Reducer must be pure. */
	reducer: (prevState: S, action: A) => S,
	/** Subscribe to the store. The callback will be called after the state has
	 *  updated and includes the action that was dispatched. */
	subscribe: (callback: (action: A) => void) => () => void,
}

type Update<S, A> = {
	prevState: S,
	action: A,
	state: S
	reducer: (prevState: S, action: A) => S
}

/**
 * React's `useReducer` already knows how to handle concurrent updates.
 */
export function useStore<S, A>(
	store: ReactExternalDataSource<S, A>,
): S {
	const [initialState] = useState(() => store.getState())

	const [state, dispatch] = useReducer((prevState: S, update: Update<S, A>): S => {
		if (Object.is(prevState, update.prevState)) {
			return update.state
		}
		return update.reducer(prevState, update.action)
	}, initialState)

	useEffect(() => {
		const state = store.getState()

		if (!Object.is(initialState, state)) {
			const update: Update<S, A> = {
				prevState: initialState,
				action: state as never,
				state,
				reducer: () => state
			}
			dispatch(update)
		}

		let prevState = state

		return store.subscribe((action) => {
			const state = store.getState()
			const update: Update<S, A> = {
				prevState,
				action,
				state,
				reducer: store.reducer
			}
			dispatch(update)
			prevState = state
		})
	}, [initialState, store])

	return state
}
