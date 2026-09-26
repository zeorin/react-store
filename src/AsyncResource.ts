/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/* eslint-disable @typescript-eslint/no-explicit-any */

import invariant from "tiny-invariant";

function isThenable(x: unknown): x is PromiseLike<unknown> {
	return typeof x === 'object'
		&& x !== null
		&& 'then' in x
		&& typeof x.then === 'function';
}

interface PendingAsyncResource<T> extends AsyncResource<T> {
	status: 'pending',
	value: never
	reason: never
}

interface FulfilledAsyncResource<T> extends AsyncResource<T> {
	status: 'fulfilled',
	value: T
	reason: never
}

interface RejectedAsyncResource<T> extends AsyncResource<T> {
	status: 'rejected',
	value: never
	reason: any
}

export interface AsyncResource<T> {
	new(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void): PendingAsyncResource<T> | FulfilledAsyncResource<T> | RejectedAsyncResource<T>;
}

/**
 * > You can pass sub-classed Promises to React such as in use() with the fields
 * > `status` and `value` or `reason`.
 * >
 * > This allows React synchronously read the value without waiting on a
 * > microtask. This is much faster but it also ensures compat when someone
 * > needs flushSync().
 * >
 * > Microtasks are bad, mkay.
 * >
 * > — [Sebastian Markbåge](https://bsky.app/profile/sebmarkbage.calyptus.eu/post/3lku7b7xjmk2w)
 *
 * We don't explicitly have to sub-class Promise, we can just implement an
 * object with the fields `status`, `value`, and `reason`
 */
export class AsyncResource<T> {
	#status: "pending" | "fulfilled" | "rejected" = "pending";
	#value?: T;
	#reason?: any;

	#resolve: (value: T | PromiseLike<T>) => void
	#reject: (reason?: any) => void

	#promise: Promise<T>

	constructor(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void) {
		const { promise, resolve, reject } = Promise.withResolvers<T>()
		this.#promise = promise
		this.#resolve = resolve
		this.#reject = reject
		executor(this.resolve.bind(this), this.reject.bind(this))
	}

	resolve(value: T | PromiseLike<T>) {
		if (isThenable(value)) {
			value.then(
				this.resolve.bind(this),
				this.reject.bind(this),
			)
		} else {
			this.#value = value;
			if (this.#status === 'pending') {
				this.#status = 'fulfilled';
				this.#resolve(value)
			}
		}
	}

	reject(reason?: any) {
		if (this.#status !== 'pending') return
		this.#status = 'rejected';
		this.#reason = reason;
		this.#reject(reason)
	}

	get value(): T {
		invariant(this.#status === 'fulfilled', 'Cannot get AsyncResource value unless it is resolved.')
		return this.#value as T
	}

	get reason(): T {
		invariant(this.#status === 'rejected', 'Cannot get AsyncResource reason unless it is rejected.')
		return this.#reason
	}

	get status() {
		return this.#status
	}

	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
	) {
		return new AsyncResource<TResult1 | TResult2>((resolve, reject) => {
			this.#promise.then(
				(value) => {
					if (onfulfilled != null) {
						resolve(onfulfilled(value))
					} else {
						resolve(value as unknown as TResult1)
					}
				},
				(reason) => {
					if (onrejected != null) {
						resolve(onrejected(reason))
					} else {
						reject(reason)
					}
				},
			)
		})
	}

	catch<TResult = never>(
		onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
	) {
		return new AsyncResource<T | TResult>((resolve, reject) => {
			this.#promise.then(
				resolve,
				(reason) => {
					if (onrejected != null) {
						resolve(onrejected(reason))
					} else {
						reject(reason)
					}
				},
			)
		})
	}

	finally(onfinally?: (() => void) | undefined | null) {
		return new AsyncResource<T>((resolve, reject) => {
			this.#promise.finally(onfinally)
			this.#promise.then(resolve, reject)
		})
	};
}
