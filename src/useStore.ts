/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/refs */
import { useEffect, useReducer, useRef } from "react";
import type { Store } from "./store";
import invariant from "tiny-invariant";

type Update<S, A> = {
	action: A,
	eagerState: S,
	processed: boolean
	next: Update<S, A>,
};

type UpdateQueue<S, A> = {
	pending: Update<S, A> | null,
	dispatch: ((update: Update<S, A>) => void),
};

type Hook<S, A> = {
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

/**
 * React's `useReducer` already knows how to handle concurrent updates.
 *
 * We can inspect how it's doing it by keeping track of what it has processed
 * and what it hasn't.
 */
export function useStore<S, A>(store: Store<S, A>): S {
	const hookRef = useRef<Hook<S, A>>(null!)

	if (hookRef.current === null) {
		const initialState = store.getState()

		const queue: UpdateQueue<S, A> = {
			pending: null,
			dispatch: null!,
		};

		queue.dispatch = (dispatchReducerUpdate<S, A>).bind(null, queue)

		hookRef.current = {
			baseState: initialState,
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

	let newState = baseState;

	let newBaseState = baseState;
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

	const [state, dispatch] = useReducer((prevState: S, update: Update<S, A>) => {
		// If the reducer is being run, it means that there	is a queue of updates to
		// be processed.
		invariant(baseQueue !== null, 'Expected baseQueue to have unprocessed updates')

		// check whether any updates have been skipped
		let skippedUpdates = false
		let cursor = baseQueue.next
		do {
			if (!cursor.processed) {
				skippedUpdates = true
			}
			cursor = cursor.next
		} while (cursor !== baseQueue.next && !skippedUpdates)

		if (!skippedUpdates) {
			// If there haven't been any skipped updates, it means we can use the
			// store's state at the time of the update directly, and it also means we
			// need to shift the base queue.
			newState = newBaseState = update.eagerState
			newBaseQueueFirst = update.next

			if (update === baseQueue) {
				// This update was the last one in the queue, all updates have been
				// flushed.
				newBaseQueueLast = null
			}
		} else {
			newState = store.reducer(prevState, update.action)
		}

		update.processed = true

		return newState
	}, store.getState())

	useEffect(() => {
		return store.subscribe((action) => {
			const state = store.getState()
			const update: Update<S, A> = {
				action,
				eagerState: state,
				processed: false,
				next: null!
			}
			hookRef.current.queue.dispatch(update)
			dispatch(update)
		})
	}, [store])

	if (newBaseQueueLast !== null) {
		invariant(newBaseQueueFirst !== null, "Expected newBaseQueueFirst to be set")
		newBaseQueueLast.next = newBaseQueueFirst;
	}

	hook.baseState = newBaseState;
	hook.baseQueue = newBaseQueueLast;

	return state
}
