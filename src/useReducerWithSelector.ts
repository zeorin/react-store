/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/immutability */
import {
	useEffect,
	useMemo,
	useRef,
	useReducer,
} from "react"

/**
 * Same as `useReducer`, but supports `selector` and `isEqual` arguments.
 */
export function useReducerWithSelector<Snapshot, Action, Selection>(
	reducer: (prevState: Snapshot, action: Action) => Snapshot,
	initialState: Snapshot,
	selector: (snapshot: Snapshot) => Selection,
	isEqual?: ((a: Selection, b: Selection) => boolean) | undefined,
): [Selection, React.Dispatch<Action>] {

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

	const [memoizedSelector, memoizedReducer] = useMemo(() => {
		// Track the memoized state using closure variables that are local to these
		// memoized instances of the selector and reducer functions. Intentionally
		// not using a useRef hook, because that state would be shared across all
		// concurrent copies of the hook/component.
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

		function memoizedReducer(prevSnapshot: Snapshot, action: Action): Snapshot {
			// We may be able to reuse the previous invocation's result.
			const prevSelection = memoizedSelection

			const nextSnapshot = reducer(prevSnapshot, action)
			const nextSelection = selector(nextSnapshot)

			// If a custom isEqual function is provided, use that to check if the
			// selection has changed. If it hasn't, return the previous snapshot. That
			// signals to React that the snapshots are conceptually equal, and we can
			// bail out of rendering.
			if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
				memoizedSnapshot = prevSnapshot
				return prevSnapshot
			}

			memoizedSnapshot = nextSnapshot
			memoizedSelection = nextSelection
			return nextSnapshot
		}

		return [memoizedSelector, memoizedReducer]
	}, [selector, isEqual, reducer])

	const [snapshot, dispatch] = useReducer(memoizedReducer, initialState)

	const value = memoizedSelector(snapshot)

	useEffect(() => {
		instRef.current.hasValue = true
		instRef.current.value = value
	}, [value])

	return [value, dispatch]
}
