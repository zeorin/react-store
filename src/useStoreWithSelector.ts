/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/immutability */
import {
	useEffect,
	useMemo,
	useRef,
} from "react"
import { useStore, type ReactExternalDataSource } from "./useStore";

/**
 * Same as `useStore`, but supports `selector` and `isEqual` arguments.
 */
export function useStoreWithSelector<Snapshot, Action, Selection>(
	store: ReactExternalDataSource<Snapshot, Action>,
	selector: (snapshot: Snapshot) => Selection,
	isEqual?: ((a: Selection, b: Selection) => boolean) | undefined,
): Selection {

	// Use this to track the rendered snapshot.
	const instRef = useRef<
		| {
			hasValue: false
			value: null
		}
		| {
			hasValue: true;
			value: Selection;
		}
	>({
		hasValue: false,
		value: null,
	})

	const [memoizedSelector, memoizedStore] = useMemo(() => {
		// Track the memoized state using closure variables that are local to this
		// memoized instance of the store. Intentionally not using a useRef hook,
		// because that state would be shared across all concurrent copies of the
		// hook/component.
		let hasMemo = false,
			memoizedSnapshot: Snapshot,
			memoizedSelection: Selection

		function memoizedSelector(nextSnapshot: Snapshot) {
			if (!hasMemo) {
				// The first time the hook is called, there is no memoized result.
				hasMemo = true
				memoizedSnapshot = nextSnapshot
				const nextSelection = selector(nextSnapshot)

				if (isEqual !== undefined) {
					// Even if the selector has changed, the currently rendered selection
					// may be equal to the new selection. We should attempt to reuse the
					// current value if possible, to preserve downstream memoizations.
					if (instRef.current.hasValue) {
						const currentSelection = instRef.current.value
						if (isEqual(currentSelection, nextSelection)) {
							memoizedSelection = currentSelection
							return currentSelection
						}
					}
				}

				memoizedSelection = nextSelection
				return nextSelection
			}

			// We may be able to reuse the previous invocation's result.
			const prevSnapshot = memoizedSnapshot
			const prevSelection = memoizedSelection

			if (Object.is(prevSnapshot, nextSnapshot)) {
				// The snapshot is the same as last time. Reuse the previous selection.
				return prevSelection
			}

			// The snapshot has changed, so we need to compute a new selection.
			const nextSelection = selector(nextSnapshot)

			// If a custom isEqual function is provided, use that to check if the
			// selection has changed. If it hasn't, return the previous selection.
			// That preserves downstream memoizations.
			if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
				// The snapshot still has changed, so make sure to update to not keep
				// old references alive
				memoizedSnapshot = nextSnapshot
				return prevSelection
			}

			memoizedSnapshot = nextSnapshot
			memoizedSelection = nextSelection
			return nextSelection
		}

		const listeners: Set<(action: Action) => void> = new Set()

		function memoizedListener(action: Action): void {
			const nextSnapshot = store.getState()
			const nextSelection = selector(nextSnapshot)

			// We may be able to reuse the previous invocation's result.
			const prevSelection = memoizedSelection

			// If a custom isEqual function is provided, use that to check if the
			// selection has changed. If it hasn't, don't notify listeners.
			if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
        // The snapshot may have changed, so make sure to update to not keep
        // old references alive
				memoizedSnapshot = nextSnapshot
				return
			}

			memoizedSnapshot = nextSnapshot
			memoizedSelection = nextSelection
			listeners.forEach(listener => listener(action))
		}

		let hasSubscription = false,
			unsubscribe: () => void

		function memoizedSubscribe(listener: (action: Action) => void): () => void {
			listeners.add(listener)
			if (!hasSubscription) {
				hasSubscription = true
				unsubscribe = store.subscribe(memoizedListener)
			}
			return () => {
				listeners.delete(listener)
				if (listeners.size === 0) {
					hasSubscription = false
					unsubscribe()
				}
			}
		}

		const memoizedStore: ReactExternalDataSource<Snapshot, Action> = {
			getState: store.getState.bind(store),
			reducer: store.reducer,
			subscribe: memoizedSubscribe
		}

		return [memoizedSelector, memoizedStore]
	}, [store, selector, isEqual])

	const snapshot = useStore(memoizedStore)

	const value = memoizedSelector(snapshot)

	useEffect(() => {
		instRef.current.hasValue = true
		instRef.current.value = value
	}, [value])

	return value
}
