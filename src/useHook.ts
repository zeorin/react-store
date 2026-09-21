/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/refs */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef } from "react"
import type { Fiber } from "react-reconciler";
import invariant from "tiny-invariant"

import { getCurrentFiberRoots } from "./getCurrentFiberRoots";

export type Update<S = any, A = any> = {
	action: A,
	eagerState: S,
	next: Update<S, A>,
};

export type UpdateQueue<S = any, A = any> = {
	pending: Update<S, A> | null,
	dispatch: ((update: Update<S, A>) => void),
};

export type Hook<S = any, A = any> = {
	memoizedState: S
	baseState: S,
	baseQueue: Update<S, A> | null,
	queue: UpdateQueue<S, A>,
	next: Hook<any, any> | null
};

export function enqueueUpdate<S, A>(
	queue: UpdateQueue<S, A>,
	update: Update<S, A>
): void {
	const pending = queue.pending
	if (pending === null) {
		// This is the first update. Create a circular list.
		update.next = update
	} else {
		// Push the update onto the queue
		update.next = pending.next;
		pending.next = update;
	}
	queue.pending = update;
}

function traverseFiber(
	fiber: Fiber | undefined,
	ascending: boolean,
	selector: (
	node: Fiber,
) => boolean | undefined,
): Fiber | null {
	if (!fiber) return null
	if (selector(fiber) === true) return fiber
	let child = ascending ? fiber.return : fiber.child
	while (child) {
		const match = traverseFiber(child, ascending, selector)
		if (match) return match
		child = ascending ? null : child.sibling
	}
	return null
}

function traverseHook<S = any, A = any>(
	hook: Hook | null,
	selector: (node: Hook) => boolean | undefined,
): Hook<S, A> | null {
	if (hook === null) return null
	if (selector(hook) === true) return hook
	let next = hook.next
	while (next) {
		const match = traverseHook(next, selector)
		if (match) return match
		next = next.next
	}
	return null
}

const uninitialized = Symbol('uninitialized')

/**
 * Access a real node in the currently rendering Fiber's `memoizedState` list.
 * This node is not used for anything, and can be used to store fiber-local
 * state.
 *
 * During a mount render, `hook` will be set, but `current` will be null. In
 * update renders, both will be set.
 *
 * They will then alternate as their fibers alternate.
 *
 * Note, however, that they do not necessarily alternate every render. This is
 * because things like render phase updates can cause more than one render pass
 * on the same fiber before it is committed.
 */
export function useHook<S = any, A = any>(): [hook: Hook<S, A>, current: Hook<S, A> | null] {
	const fiberRoots = getCurrentFiberRoots()

	// These are the needles in our haystack
	const sentinelRef = useRef<symbol>(null!)
	if (sentinelRef.current === null) {
		sentinelRef.current = Symbol('sentinel')
	}

	// This is the hook whose internal state we're about to get
	useRef<S>(uninitialized as never)

	let hook: Hook<S, A> | null = null
	let current: Hook<S, A> | null = null

	for (const fiberRoot of fiberRoots) {
		while (hook === null) {
			// `alternate` is the WIP fiber, unless it's the very first render, then
			// there is no alternate.
			const fiber = traverseFiber(
				fiberRoot.current.alternate ?? fiberRoot.current,
				false,
				(fiber) => {
					const sentinelHook = traverseHook(
						fiber.memoizedState,
						(node) => typeof node.memoizedState === 'object'
							&& node.memoizedState !== null
							&& 'current' in node.memoizedState
							&& node.memoizedState.current === sentinelRef.current
					)
					if (sentinelHook) {
						hook = sentinelHook.next
						return true
					}
				})

			if (fiber) {
				const sentinelCurrent = traverseHook(
					fiber.alternate?.memoizedState ?? null,
					(node) => typeof node.memoizedState === 'object'
						&& node.memoizedState !== null
						&& 'current' in node.memoizedState
						&& node.memoizedState.current === sentinelRef.current
				)
				if (sentinelCurrent) {
					current = sentinelCurrent.next
				}
			}
		}
	}

	invariant(hook !== null)

	return [hook, current]
}
