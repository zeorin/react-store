/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/refs */
import { useDebugValue, useEffect, useMemo, useReducer, useRef, useState, type ActionDispatch } from "react";
import type { Store } from "./store";
import invariant from "tiny-invariant";

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

type Update<S, A> = {
	action: A,
	eagerState: S,
	next: Update<S, A>,
};

type UpdateQueue<S, A> = {
	pending: Update<S, A> | null,
	dispatch: ((update: Update<S, A>) => void),
};

type Hook<S, A> = {
	memoizedState: S
	baseState: S,
	baseQueue: Update<S, A> | null,
	queue: UpdateQueue<S, A>,
};

function enqueueUpdate<S, A>(
	queue: UpdateQueue<S, A>,
	update: Update<S, A>
): void {
	const pending = queue.pending
	if (pending === null) {
		// This is the first update. Create a circular list.
		update.next = update
	} else {
		update.next = pending.next;
		pending.next = update;
	}
	queue.pending = update;
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

/**
 * React's `useReducer` already knows how to handle concurrent updates.
 *
 * We can inspect how it's doing it by keeping track of what it has processed
 * and what it hasn't.
 */
export function useStore<S, A, T = S>(
	store: Store<S, A>,
	selector: ((state: S) => T) = identity as never,
	isEqual: ((a: T, b: T) => boolean) = Object.is,
): T {
	const hookRef = useRef<Hook<[S, T], A>>(null!)

	if (hookRef.current === null) {
		const state = store.getState()
		const selection = selector(state)
		const memoizedState: [S, T] = [state, selection]

		const queue: UpdateQueue<[S, T], A> = {
			pending: null,
			dispatch: null!,
		};

		queue.dispatch = (dispatchReducerUpdate<[S, T], A>).bind(null, queue)

		const hook: Hook<[S, T], A> = {
			memoizedState,
			baseState: memoizedState,
			baseQueue: null,
			queue
		}

		hookRef.current = hook
	}

	const getHook = useMemo(() => {
		const { current } = hookRef

		const hook: Hook<[S, T], A> = {
			memoizedState: current.memoizedState,
			baseState: current.baseState,
			baseQueue: current.baseQueue,
			queue: current.queue
		}

		return () => hook
	}, [])

	const hook = getHook()

	const queue = hook.queue

	// The last rebase update that is NOT part of the base state.
	let baseQueue = hook.baseQueue;

	// The last pending update that hasn't been processed yet.
	const pendingQueue = queue.pending;
	if (pendingQueue !== null) {
		// We have new updates that haven't been processed yet.
		// We'll add them to the base queue.
		if (baseQueue !== null) {
			// Merge the pending queue and the base queue.
			const baseFirst = baseQueue.next;
			const pendingFirst = pendingQueue.next;
			baseQueue.next = pendingFirst;
			pendingQueue.next = baseFirst;
		}
		hookRef.current.baseQueue = baseQueue = pendingQueue;
		queue.pending = null;
	}

	const baseState = hook.baseState;

	let dispatch: ActionDispatch<[update: Update<[S, T], A>]>

	if (baseQueue === null) {
		hook.memoizedState = baseState
		function reducer() {
			return hook.memoizedState[1]
		}
		// eslint-disable-next-line react-hooks/rules-of-hooks -- we call it a consistent number of times
		dispatch = useReducer(reducer, hook.memoizedState[1])[1]
	} else {
		// We have a queue to process.
		let newState = baseState;
		let prevState = newState;

		let newBaseState = baseState;
		let newBaseQueueFirst = baseQueue.next;
		let newBaseQueueLast: Update<[S, T], A> | null = baseQueue;

		// Keep track of whether we've already processed an update this render so we
		// can use the cached result.
		const processed = new Map<Update<[S, T], A>, T>

		function reducer(_prevState: T, update: Update<[S, T], A>) {
			// React checks whether the reducer is pure by running it twice in strict
			// mode in dev, per update. This is a completely artificial invocation that
			// will *never* happen in any other circumstance (at, least, not in the same
			// render pass).
			// Just return the cached result
			if (processed.has(update)) {
				return processed.get(update)!
			}

			// If the reducer is being run, it means that there	is a queue of updates to
			// be processed.
			invariant(baseQueue !== null, 'Expected baseQueue to have unprocessed updates')

			const hasSkippedUpdate = processed.size !== 0 && [...processed.keys()][processed.size - 1].next !== update

			if (!hasSkippedUpdate) {
				// If there haven't been any skipped updates, it means we can use the
				// store's state at the time of the update directly, and it also means we
				// need to shift the base queue.
				newBaseState[0] = newState[0] = update.eagerState[0]
				if (!isEqual(newBaseState[1], update.eagerState[1])) {
					newBaseState[1] = update.eagerState[1]
				}
				if (!isEqual(newState[1], update.eagerState[1])) {
					newState[1] = update.eagerState[1]
				}

				if (update === baseQueue) {
					// This update was the last one in the queue, all updates have been
					// flushed.
					newBaseQueueLast = null
				} else {
					newBaseQueueFirst = update.next
				}
			} else {
				newState[0] = store.reducer(newState[0], update.action)
				const selection = selector(newState[0])
				if (!isEqual(newState[1], selection)) {
					newState[1] = selection
				}
			}

			processed.set(update, newState[1])

			return newState[1]
		}

		// eslint-disable-next-line react-hooks/rules-of-hooks -- we call it a consistent number of times
		dispatch = useReducer(reducer, hook.memoizedState[1])[1]

		if (newBaseQueueLast !== null) {
			newBaseQueueLast.next = newBaseQueueFirst;
		}

		hook.memoizedState = newState;
		hook.baseState = newBaseState;
		hook.baseQueue = newBaseQueueLast;
	}

	const [prevSelector, setPrevSelector] = useState(() => selector)
	const [prevIsEqual, setPrevIsEqual] = useState(() => isEqual)

	const selectorChanged = prevSelector !== selector
	const isEqualChanged = prevIsEqual !== isEqual

	const numberOfReRendersRef = useRef(0)
	const probablyUsingReferentiallyUnstableFunctionsRef = useRef(false)

	if (!(selectorChanged || isEqualChanged)) {
		numberOfReRendersRef.current = 0
	} else {
		let eagerStateChanged = false

		// re-compute the selections on the queues
		const baseQueue = hook.baseQueue
		const pendingQueue = hook.queue.pending
		for (const queue of [baseQueue, pendingQueue]) {
			if (queue === null) continue
			let cursor = queue.next
			do {
				const selection = selector(cursor.eagerState[0])
				if (!isEqual(cursor.eagerState[1], selection)) {
					eagerStateChanged = true
					cursor.eagerState[1] = selection
				}
				cursor = cursor.next
			} while (cursor !== queue.next)
		}

		let memoizedStateChanged = false

		// Re-compute the memoizedState selection
		const newSelection = selector(hook.memoizedState[0])
		if (!isEqual(hook.memoizedState[1], newSelection)) {
			hook.memoizedState[1] = newSelection
			memoizedStateChanged = true
		}

		// Re-compute the baseState selection
		if (baseQueue === null && memoizedStateChanged && hook.memoizedState[0] === hook.baseState[0]) {
			hook.baseState[1] = hook.memoizedState[1]
		} else {
			const newBaseSelection = selector(hook.baseState[0])
			if (!isEqual(hook.baseState[1], newBaseSelection)) {
				hook.baseState[1] = newBaseSelection
				eagerStateChanged = true
			}
		}

		// Force re-render only if anything actually changed
		if (eagerStateChanged || memoizedStateChanged) {
			numberOfReRendersRef.current = 0
			if (selectorChanged) setPrevSelector(() => selector)
			if (isEqualChanged) setPrevIsEqual(() => isEqual)
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
				if (selectorChanged) setPrevSelector(() => selector)
				if (isEqualChanged) setPrevIsEqual(() => isEqual)
			}
		}
	}

	useEffect(() => {
		// TODO: handle updates dispatched after mount but before subscription

		return store.subscribe((action) => {
			const state = store.getState()
			const selection = selector(state)
			const update: Update<[S, T], A> = {
				action,
				eagerState: [state, selection],
				next: null!
			}
			queue.dispatch(update)
			dispatch(update)
		})
	}, [store, selector, isEqual, dispatch, queue])

	useDebugValue(hook.memoizedState[1])

	return hook.memoizedState[1]
}
