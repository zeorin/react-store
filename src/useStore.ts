/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/refs */
import { useDebugValue, useEffect, useReducer, useRef } from "react";
import type { Store } from "./store";
import invariant from "tiny-invariant";

type Update<S, A, T> = {
	action: A,
	eagerState: S,
	eagerSelection: T,
	processed: boolean
	next: Update<S, A, T>,
};

type UpdateQueue<S, A, T> = {
	pending: Update<S, A, T> | null,
	dispatch: ((update: Update<S, A, T>) => void),
};

type Hook<S, A, T> = {
	baseState: S,
	baseSelection: T,
	baseQueue: Update<S, A, T> | null,
	queue: UpdateQueue<S, A, T>,
};

function enqueueUpdate<S, A, T>(
	queue: UpdateQueue<S, A, T>,
	update: Update<S, A, T>
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

function dispatchReducerUpdate<S, A, T>(
	queue: UpdateQueue<S, A, T>,
	update: Update<S, A, T>
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
	isEqual: ((a: T, b: T) => boolean) = Object.is
): T {
	const hookRef = useRef<Hook<S, A, T>>(null!)

	if (hookRef.current === null) {
		const initialState = store.getState()
		const initialSelection = selector(initialState)

		const queue: UpdateQueue<S, A, T> = {
			pending: null,
			dispatch: null!,
		};

		queue.dispatch = (dispatchReducerUpdate<S, A, T>).bind(null, queue)

		hookRef.current = {
			baseState: initialState,
			baseSelection: initialSelection,
			baseQueue: null,
			queue,
		}
	}

	const hook = hookRef.current

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
		baseQueue = pendingQueue;
		queue.pending = null;
	}

	const baseState = hook.baseState;
	const baseSelection = hook.baseSelection;

	let newState = baseState;
	let newSelection = baseSelection;

	let newBaseState = baseState;
	let newBaseSelection = baseSelection;
	let newBaseQueueFirst = baseQueue?.next ?? null;
	let newBaseQueueLast = baseQueue;

	// Mark all the updates as unprocessed
	if (baseQueue) {
		let cursor = baseQueue.next
		do {
			cursor.processed = false
			cursor = cursor.next
		} while (cursor !== baseQueue.next)
	}

	let prevState = newState;

	const [state, dispatch] = useReducer((prevSelection: T, update: Update<S, A, T>) => {
		// If the reducer is being run, it means that there	is a queue of updates to
		// be processed.
		invariant(baseQueue !== null, 'Expected baseQueue to have unprocessed updates')

		// React checks whether the reducer is pure by running it twice in strict
		// mode in dev, per update.
		// Our reducer isn't pure, but it ought to be at least idempotent
		if (prevSelection === newSelection) {
			prevState = newState
		}

		// check whether any updates have been skipped
		let skippedUpdates = false
		let cursor = baseQueue.next
		while (cursor !== update && !skippedUpdates) {
			if (!cursor.processed) {
				skippedUpdates = true
			}
			cursor = cursor.next
		}

		if (!skippedUpdates) {
			// If there haven't been any skipped updates, it means we can use the
			// store's state at the time of the update directly, and it also means we
			// need to shift the base queue.
			newState = newBaseState = update.eagerState
			if (!isEqual(newBaseSelection, update.eagerSelection)) {
				newBaseSelection = update.eagerSelection
			}
			if (!isEqual(newSelection, update.eagerSelection)) {
				newSelection = update.eagerSelection
			}

			if (update === baseQueue) {
				// This update was the last one in the queue, all updates have been
				// flushed.
				newBaseQueueFirst = null
				newBaseQueueLast = null
			} else {
				newBaseQueueFirst = update.next
			}
		} else {
			newState = store.reducer(prevState, update.action)
			const selection = selector(newState)
			if (!isEqual(newSelection, selection)) {
				newSelection = selection
			}
		}

		update.processed = true

		return newSelection
	}, selector(store.getState()))

	useEffect(() => {
		// the selector might have changed,
		// re-compute the selections on the queues
		const baseQueue = hookRef.current.baseQueue
		const pendingQueue = hookRef.current.queue.pending
		for (const queue of [baseQueue, pendingQueue]) {
			if (queue === null) continue
			let cursor = queue.next
			do {
				const selection = selector(cursor.eagerState)
				if (!isEqual(cursor.eagerSelection, selection)) {
					cursor.eagerSelection = selection
				}
				cursor = cursor.next
			} while (cursor !== queue.next)
		}

		// TODO: handle updates dispatched after mount but before subscription
		// TODO: trigger a refresh if the selections have changed

		return store.subscribe((action) => {
			const state = store.getState()
			const selection = selector(state)
			const update: Update<S, A, T> = {
				action,
				eagerState: state,
				eagerSelection: selection,
				processed: false,
				next: null!
			}
			hookRef.current.queue.dispatch(update)
			dispatch(update)
		})
	}, [store, selector, isEqual])

	if (newBaseQueueLast !== null) {
		invariant(newBaseQueueFirst !== null, "Expected newBaseQueueFirst to be set")
		newBaseQueueLast.next = newBaseQueueFirst;
	}

	hook.baseState = newBaseState;
	hook.baseSelection = newBaseSelection;
	hook.baseQueue = newBaseQueueLast;

	useDebugValue(state)

	return state
}
