/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/refs */
import {
	useDebugValue,
	useEffect,
	useReducer,
	useRef,
	useState,
} from "react";
import invariant from "tiny-invariant";

import type { Store } from "./store";
import {
	enqueueUpdate,
	useHook,
	type Hook,
	type Update,
	type UpdateQueue
} from "./useHook";

let didWarnAboutReferentialStability = false

const RE_RENDER_LIMIT = 25;

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

function dispatchReducerUpdate<S, A>(
	queue: UpdateQueue<S, A>,
	update: Update<S, A>
): void {
	enqueueUpdate(queue, update);
}

function identity<T>(x: T): T {
	return x
}

type State<S, T> = {
	snapshot: S,
	selection: T
}

/**
 * React's `useReducer` already knows how to handle concurrent updates.
 *
 * We can inspect how it's doing it by keeping track of what it has processed
 * and what it hasn't.
 */
export function useStore<S, A, T = S>(
	store: Store<S, A>,
	selector: ((snapshot: S) => T) = identity as never,
	isEqual: ((a: T, b: T) => boolean) = Object.is,
): T {
	const [hook, current] = useHook<State<S, T>, A>()

	const prevHookRef = useRef<Hook<State<S, T>, A>>(null)
	const isMountRender = prevHookRef.current === null
	const isUpdateRender = prevHookRef.current === current
	const isRerender = prevHookRef.current === hook
	prevHookRef.current = hook

	let dispatch: React.ActionDispatch<[update: Update<State<S, T>, A>]>

	/** Not expected to ever be called */
	function noopReducer() {
		if (import.meta.env.DEV) {
			console.error('[useStore] No-op reducer was unexpectedly called. This is a bug.')
		}
		return hook.memoizedState.selection
	}

	if (isMountRender) {

		invariant(current === null)

		const snapshot = store.getState()
		const selection = selector(snapshot)
		const initialState: State<S, T> = { snapshot, selection }

		const queue: UpdateQueue<State<S, T>, A> = {
			pending: null,
			dispatch: null!,
		};

		queue.dispatch = (dispatchReducerUpdate<State<S, T>, A>).bind(null, queue)

		hook.memoizedState = initialState
		hook.baseState = initialState
		hook.baseQueue = null
		hook.queue = queue

		// eslint-disable-next-line react-hooks/rules-of-hooks -- it's OK, we also call it below in the other branches
		dispatch = useReducer(noopReducer, hook.memoizedState.selection)[1]
	} else if (isUpdateRender) {

		const queue = hook.queue

		// The last rebase update that is NOT part of the base state.
		let baseQueue = hook.baseQueue;

		// The last pending update that hasn't been processed yet.
		const pendingQueue = queue.pending;
		if (pendingQueue !== null) {
			invariant(current)

			// We have new updates that haven't been processed yet.
			// We'll add them to the base queue.
			if (baseQueue !== null) {
				// Merge the pending queue and the base queue.
				const baseFirst = baseQueue.next;
				const pendingFirst = pendingQueue.next;
				baseQueue.next = pendingFirst;
				pendingQueue.next = baseFirst;
			}
			if (import.meta.env.DEV) {
				invariant(current.baseQueue === baseQueue, '[useStore] Expected work-in-progress queue to be a clone. ' +
					'This is a bug in useStore')
			}
			current.baseQueue = baseQueue = pendingQueue;
			queue.pending = null;
		}

		const baseState = hook.baseState;
		if (baseQueue === null) {
			// If there are no pending updates, then the memoized state should be the
			// same as the base state. Currently these only diverge in the case of
			// useOptimistic, because useOptimistic accepts a new baseState on
			// every render.
			hook.memoizedState = baseState
			// eslint-disable-next-line react-hooks/rules-of-hooks -- it's OK, we also call it below in the other branch
			dispatch = useReducer(noopReducer, hook.memoizedState.selection)[1]
		} else {
			// We have a queue to process.
			let newState = baseState;

			// There's a chance that the first, or even all updates might be skipped, So
			// we set up the new base queue and state right away.
			let newBaseState = baseState;
			let newBaseQueueFirst: Update<State<S, T>, A>;
			let newBaseQueueLast: Update<State<S, T>, A>;

			let update = baseQueue.next
			do {
				const clone: Update<State<S, T>, A> = {
					action: update.action,
					eagerState: update.eagerState,
					next: null!,
				};

				if (!newBaseQueueLast!) {
					// This is the first update,
					// create a circular linked list
					clone.next = clone
					newBaseQueueFirst = newBaseQueueLast = clone;
				} else {
					clone.next = newBaseQueueFirst!
					newBaseQueueLast = newBaseQueueLast.next = clone;
				}
				update = update.next
			} while (update !== baseQueue.next)

			if (import.meta.env.DEV) {
				invariant(newBaseQueueFirst!)
				invariant(newBaseQueueLast)
			}

			// Work around TS 2454 "Variable is used before being assigned"
			newBaseQueueFirst = newBaseQueueFirst!

			// Keep track of whether we've already processed an update this render so we
			// can use the cached result.
			const processed = new Map<Update<State<S, T>, A>, T>

			let didSkipUpdates = true

			function reducer(_prevState: T, update: Update<State<S, T>, A>) {
				// React checks whether the reducer is pure by running it twice in strict
				// mode in dev, per update. This is a completely artificial double
				// invocation. Just return the cached result.
				if (processed.has(update)) {
					return processed.get(update)!
				}

				const prevState = newState
				const prevBaseState = newBaseState

				// The base queue is made of clones, but the updates that React gives us
				// were the originally dispatched objects. The `eagerState` has a stable
				// referential identity, even across cloned queues.
				if (update.eagerState === newBaseQueueFirst.eagerState) {
					didSkipUpdates = false

					// If there haven't been any skipped updates, it means we can use the
					// supplied eager state directly.
					newState = {
						snapshot: update.eagerState.snapshot,
						selection: update.eagerState.selection,
					}

					// It is also the new base state
					newBaseState = {
						snapshot: update.eagerState.snapshot,
						selection: update.eagerState.selection,
					};

					if (isEqual(newBaseState.selection, prevBaseState.selection)) {
						newBaseState.selection = prevBaseState.selection
					}

					// And we can shift its clone off the base queue
					newBaseQueueLast.next = newBaseQueueFirst = newBaseQueueFirst.next
				} else {
					didSkipUpdates = true
					const snapshot = store.reducer(prevState.snapshot, update.action)
					const selection = selector(snapshot)
					newState = { snapshot, selection }
					// update.eagerState.snapshot = snapshot
					// update.eagerState.selection = selection
				}

				if (isEqual(newState.selection, prevState.selection)) {
					newState.selection = prevState.selection
				}

				processed.set(update, newState.selection)

				return newState.selection
			}

			// eslint-disable-next-line react-hooks/rules-of-hooks -- we call it a consistent number of times
			dispatch = useReducer(reducer, hook.memoizedState.selection)[1]

			hook.memoizedState = newState;
			hook.baseState = newBaseState;

			if (didSkipUpdates) {
				hook.baseQueue = newBaseQueueLast;
			} else {
				hook.baseQueue = null
			}
		}
	} else if (isRerender) {
		const queue = hook.queue

		// Apply the new render phase updates to the previous
		// work-in-progress hook.
		const lastRenderPhaseUpdate = queue.pending;
		let newState = hook.memoizedState;
		if (lastRenderPhaseUpdate === null) {
			// eslint-disable-next-line react-hooks/rules-of-hooks -- we call it a consistent number of times
			dispatch = useReducer(noopReducer, hook.memoizedState.selection)[1]
		} else {
			// The queue doesn't persist past this render pass.
			queue.pending = null;

			const didSkipUpdates = hook.baseQueue !== null

			function reducer(_prevState: T, update: Update<State<S, T>, A>) {
				const prevState = newState

				// The base queue is made of clones, but the updates that React gives us
				// were the originally dispatched objects. The `eagerState` has a stable
				// referential identity, even across cloned queues.
				if (!didSkipUpdates) {

					// If there haven't been any skipped updates, it means we can use the
					// supplied eager state directly.
					newState = {
						snapshot: update.eagerState.snapshot,
						selection: update.eagerState.selection,
					}
				} else {
					const snapshot = store.reducer(prevState.snapshot, update.action)
					const selection = selector(snapshot)
					newState = { snapshot, selection }
					// update.eagerState.snapshot = snapshot
					// update.eagerState.selection = selection
				}

				if (isEqual(newState.selection, prevState.selection)) {
					newState.selection = prevState.selection
				}

				return newState.selection
			}

			// eslint-disable-next-line react-hooks/rules-of-hooks -- we call it a consistent number of times
			dispatch = useReducer(reducer, hook.memoizedState.selection)[1]

			hook.memoizedState = newState;
			// Don't persist the state accumulated from the render phase updates to
			// the base state unless the queue is empty.
			if (hook.baseQueue === null) {
				hook.baseState = newState;
			}
		}
	} else {
		// We should never reach this branch
		invariant(false)
	}

	const queue = hook.queue

	const [prevSelector, setPrevSelector] = useState(() => selector)
	const [prevIsEqual, setPrevIsEqual] = useState(() => isEqual)

	const selectorDidChange = prevSelector !== selector
	const isEqualDidChange = prevIsEqual !== isEqual

	const numberOfReRendersRef = useRef(0)
	const probablyUsingReferentiallyUnstableFunctionsRef = useRef(false)

	if (!selectorDidChange && !isEqualDidChange) {
		numberOfReRendersRef.current = 0
	} else {
		let selectionDidChange = false

		// re-compute the selections on the queues
		const baseQueue = hook.baseQueue
		const pendingQueue = hook.queue.pending
		for (const queue of [baseQueue, pendingQueue]) {
			if (queue === null) continue
			let cursor = queue.next
			do {
				const selection = selector(cursor.eagerState.snapshot)
				if (!isEqual(cursor.eagerState.selection, selection)) {
					cursor.eagerState.selection = selection
					selectionDidChange = true
				}
				cursor = cursor.next
			} while (cursor !== queue.next)
		}

		{
			// Re-compute the memoizedState selection
			const selection = selector(hook.memoizedState.snapshot)
			if (!isEqual(hook.memoizedState.selection, selection)) {
				hook.memoizedState.selection = selection
				selectionDidChange = true
			}
		}

		{
			// Re-compute the baseState selection
			const selection = selector(hook.baseState.snapshot)
			if (!isEqual(hook.baseState.selection, selection)) {
				hook.baseState.selection = selection
				selectionDidChange = true
			}
		}

		// Force re-render only if anything actually changed
		if (selectionDidChange) {
			numberOfReRendersRef.current = 0
			if (selectorDidChange) setPrevSelector(() => selector)
			if (isEqualDidChange) setPrevIsEqual(() => isEqual)
		} else {
			numberOfReRendersRef.current++
			if (numberOfReRendersRef.current === RE_RENDER_LIMIT) {
				numberOfReRendersRef.current = 0
				if (import.meta.env.DEV && !didWarnAboutReferentialStability) {
					console.error(
						"[useStore] Too many re-renders. Either the selector or the " +
						"isEqual function keeps changing, but the selected value doesn't. " +
						"This probably means that one or both of these functions is " +
						"not referentially stable."
					);
					// eslint-disable-next-line react-hooks/globals
					didWarnAboutReferentialStability = true
					probablyUsingReferentiallyUnstableFunctionsRef.current = true
				}
			} else if (!probablyUsingReferentiallyUnstableFunctionsRef.current) {
				if (selectorDidChange) setPrevSelector(() => selector)
				if (isEqualDidChange) setPrevIsEqual(() => isEqual)
			}
		}
	}

	invariant(dispatch!)

	useEffect(() => {
		// TODO: handle updates dispatched after mount but before subscription

		return store.subscribe((action) => {
			const snapshot = store.getState()
			const selection = selector(snapshot)
			const update: Update<State<S, T>, A> = {
				action,
				eagerState: { snapshot, selection },
				next: null!
			}
			queue.dispatch(update)
			dispatch(update)
		})
	}, [store, selector, isEqual, dispatch, queue])

	useDebugValue(hook.memoizedState.selection)

	return hook.memoizedState.selection
}
