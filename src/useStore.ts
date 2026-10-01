/* eslint-disable react-hooks/immutability */
import {
	useDebugValue,
	useEffect,
	useMemo,
	useReducer,
} from "react";
import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";

export interface ReactExternalDataSource<S, A> {
	/** Get the current snapshot of the store. Snapshot must be immutable. */
	getState(): S,
	/** The stable reducer function used by the store to produce new snapshots.
	 *  Reducer must be pure. */
	reducer: (prevSnapshot: S, action: A) => S,
	/** Subscribe to the store. The callback will be called after the snapshot has
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
	const [initialValue, reducer, subscribe, storeConsistencyCheck] = useMemo(() => {
		const initialValue = store.getState()

		// Track the memoized snapshot using a closure variable that is local to
		// this instance of the store. Intentionally not using a useRef hook,
		// because that would be shared across all concurrent copies of the
		// hook/component.
		let memoizedSnapshot = initialValue

		function reducer(prevState: S, update: Update<S, A>): S {
			const nextState = Object.is(prevState, update.prevState)
				? update.state
				: update.reducer(prevState, update.action)
			memoizedSnapshot = nextState
			return nextState
		}

		function subscribe(): () => void {
			// TODO: Is the consistency check actually needed here?
			let prevSnapshot = storeConsistencyCheck(store.getState())
			return store.subscribe((action) => {
				const snapshot = store.getState()
				const update: Update<S, A> = {
					prevState: prevSnapshot,
					action,
					state: snapshot,
					reducer: store.reducer
				}
				dispatch(update)
				prevSnapshot = snapshot
			})
		}

		function storeConsistencyCheck(nextSnapshot: S) {
			if (!Object.is(memoizedSnapshot, nextSnapshot)) {
				// The snapshot is not the same as last time. Schedule an update.
				const update: Update<S, A> = {
					prevState: memoizedSnapshot,
					action: nextSnapshot as never,
					state: nextSnapshot,
					reducer: () => nextSnapshot
				}
				dispatch(update)
			}
			memoizedSnapshot = nextSnapshot
			return nextSnapshot
		}

		return [initialValue, reducer, subscribe, storeConsistencyCheck]
	}, [store])

	const [snapshot, dispatch] = useReducer(reducer, initialValue)

	useIsomorphicLayoutEffect(() => {
		storeConsistencyCheck(initialValue)
	}, [initialValue, storeConsistencyCheck])

	useEffect(subscribe, [subscribe])

	const value = storeConsistencyCheck(snapshot)

	useDebugValue(value)

	return value
}
