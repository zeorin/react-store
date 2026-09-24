/* eslint-disable @typescript-eslint/no-explicit-any */
import { compareVersions } from 'compare-versions';
import type { Fiber, FiberRoot } from 'react-reconciler';
import invariant from 'tiny-invariant';

/**
 * A self-contained handle over the installed DevTools hook and the runtime
 * state it tracks. Building blocks (createTools, the tree/profiler factories)
 * read from a Facade and never touch globals, so the integrator fully owns it.
 */
type Facade = {
	hook: React.DevTools.Hook,
	fiberRoots: Map<number, Set<FiberRoot>>,
	rendererInternals: Map<number, React.DevTools.RendererInternals>,
	profilingState: ProfilingState,
};

type FacadeTarget = {
	__REACT_DEVTOOLS_GLOBAL_HOOK__?: React.DevTools.Hook
}

declare global {
	var __REACT_DEVTOOLS_GLOBAL_HOOK__: React.DevTools.Hook | undefined
}

/**
 * Install the React DevTools facade and return a Facade handle.
 *
 * If `__REACT_DEVTOOLS_GLOBAL_HOOK__` is not yet present, this installs the
 * facade's own minimal hook (the global React looks for at init). If a hook is
 * already installed — e.g. the user has the React DevTools browser extension —
 * the facade attaches to that hook instead of installing a second one.
 *
 * Install before React initializes so the first commit is captured; when
 * attaching, roots committed before attach are back-filled from the existing
 * hook.
 */
export function installFacade(target: FacadeTarget = globalThis): Facade {
	const fiberRoots: Map<number, Set<FiberRoot>> = new Map();
	const rendererInternals: Map<number, React.DevTools.RendererInternals> = new Map();
	const profilingState: ProfilingState = {
		isActive: false,
		currentTraceName: null,
		traces: new Map(),
		onCommit: null,
		onPostCommit: null,
	};

	// A hook is already installed (e.g. the React DevTools extension). Attach to
	// it rather than replacing it.
	const existingHook = target.__REACT_DEVTOOLS_GLOBAL_HOOK__;
	if (existingHook != null) {
		attachToExistingHook(
			existingHook,
			fiberRoots,
			rendererInternals,
			profilingState,
		);
		return { hook: existingHook, fiberRoots, rendererInternals, profilingState };
	}

	let registeredRenderersCount = 0;

	const hook: React.DevTools.Hook = {
		listeners: {},
		rendererInterfaces: new Map(),
		renderers: new Map(),
		hasUnsupportedRendererAttached: false,
		backends: new Map(),
		emit() {},
		getFiberRoots(rendererID: number) {
			let roots = fiberRoots.get(rendererID);
			if (roots == null) {
				roots = new Set();
				fiberRoots.set(rendererID, roots);
			}
			return roots;
		},
		inject(renderer: ReactReconciler.ReactRenderer): number {
			const id = registeredRenderersCount++;
			hook.renderers.set(id, renderer);
			return id;
		},
		on() {},
		off() {},
		sub() {
			return () => {};
		},
		supportsFiber: true,
		supportsFlight: true,
		checkDCE() {},
		onCommitFiberRoot(rendererID: number, root: FiberRoot, schedulerPriority?: number) {
			syncFiberRoots(fiberRoots, rendererID, root);
			if (profilingState.isActive && profilingState.onCommit != null) {
				profilingState.onCommit(rendererID, root, schedulerPriority);
			}
		},
		onCommitFiberUnmount() {},
		onPostCommitFiberRoot(_rendererID: number, root: FiberRoot) {
			if (profilingState.isActive && profilingState.onPostCommit != null) {
				profilingState.onPostCommit(root);
			}
		},
		onScheduleFiberRoot(rendererID: number, root: FiberRoot) {
			syncFiberRoots(fiberRoots, rendererID, root);
		},
	};

	Object.defineProperty(target, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
		configurable: import.meta.env.DEV,
		enumerable: false,
		get() {
			return hook;
		},
	});

	return { hook, fiberRoots, rendererInternals, profilingState };
}

const facade = installFacade()

export { facade }

function attachToExistingHook(
	hook: React.DevTools.Hook,
	fiberRoots: Map<number, Set<FiberRoot>>,
	rendererInternals: Map<number, React.DevTools.RendererInternals>,
	profilingState: ProfilingState,
): void {
	// Back-fill renderers and roots registered before we attached (React may have
	// initialized first).
	if (hook.renderers instanceof Map) {
		Array.from(hook.renderers.entries(), ([id, renderer]) => {
			if (!rendererInternals.has(id)) {
				initializeRendererInternals(rendererInternals, id, renderer);
			}
			if (typeof hook.getFiberRoots === 'function') {
				let roots = fiberRoots.get(id);
				if (roots == null) {
					roots = new Set();
					fiberRoots.set(id, roots);
				}
				// Alias to a const so the non-null refinement survives into the closure.
				const mountedRoots = roots;
				hook.getFiberRoots(id).forEach((root: FiberRoot) => {
					mountedRoots.add(root);
				});
			}
		});
	}

	const originalInject = hook.inject;
	hook.inject = function inject(renderer: ReactReconciler.ReactRenderer, ...rest: any[]): number {
		// @ts-expect-error -- just in case they add extra params in the future
		const id = originalInject.call(hook, renderer, ...rest);
		if (typeof id === 'number') {
			initializeRendererInternals(rendererInternals, id, renderer);
		}
		invariant(id != null)
		return id;
	};

	const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
	hook.onCommitFiberRoot = function onCommitFiberRoot(
		rendererID: number,
		root: FiberRoot,
		schedulerPriority?: number,
		...rest: any[]
	) {
		if (typeof originalOnCommitFiberRoot === 'function') {
			originalOnCommitFiberRoot.call(
				hook,
				rendererID,
				root,
				schedulerPriority,
				...rest,
			);
		}
		syncFiberRoots(fiberRoots, rendererID, root);
		if (profilingState.isActive && profilingState.onCommit != null) {
			profilingState.onCommit(rendererID, root, schedulerPriority);
		}
	};

	const originalOnPostCommitFiberRoot = hook.onPostCommitFiberRoot;
	hook.onPostCommitFiberRoot = function onPostCommitFiberRoot(
		rendererID: number,
		root: FiberRoot,
		...rest: any[]
	) {
		if (typeof originalOnPostCommitFiberRoot === 'function') {
			// @ts-expect-error -- just in case they add extra params in the future
			originalOnPostCommitFiberRoot.call(hook, rendererID, root, ...rest);
		}
		if (profilingState.isActive && profilingState.onPostCommit != null) {
			profilingState.onPostCommit(root);
		}
	};

	const originalOnScheduleFiberRoot = hook.onScheduleFiberRoot;
	hook.onScheduleFiberRoot = function onScheduleFiberRoot(
		rendererID: number,
		root: FiberRoot,
		children: React.ReactNode,
		...rest: any[]
	) {
		if (typeof originalOnScheduleFiberRoot === 'function') {
			originalOnScheduleFiberRoot.call(
				hook,
				rendererID,
				root,
				children,
				// @ts-expect-error -- just in case they add extra params in the future
				...rest,
			);
		}
		syncFiberRoots(fiberRoots, rendererID, root);
	};
}

// Initialize per-renderer internal constants for a renderer registered with the
// hook. Shared by the installed hook's inject() and the attach path.
function initializeRendererInternals(
	rendererInternals: Map<number, React.DevTools.RendererInternals>,
	id: number,
	renderer: any,
): void {
	const version = renderer.reconcilerVersion || renderer.version;
	if (version == null) {
		console.error(
			'react-devtools-facade: Renderer %s has no version, internals not initialized.',
			id,
		);
		return;
	}
	const { getDisplayNameForFiber, ReactTypeOfWork, ReactPriorityLevels } =
		getInternalReactConstants(version);
	rendererInternals.set(id, {
		getDisplayNameForFiber,
		ReactTypeOfWork,
		ReactPriorityLevels,
		currentDispatcherRef: renderer.currentDispatcherRef,
	});
}

function syncFiberRoots(
	fiberRoots: Map<number, Set<FiberRoot>>,
	rendererID: number,
	root: FiberRoot,
): void {
	let mountedRoots = fiberRoots.get(rendererID);
	if (mountedRoots == null) {
		mountedRoots = new Set();
		fiberRoots.set(rendererID, mountedRoots);
	}
	const current = root.current;
	const isKnownRoot = mountedRoots.has(root);
	const isUnmounting =
		current.memoizedState == null || current.memoizedState.element == null;
	if (!isKnownRoot && !isUnmounting) {
		mountedRoots.add(root);
	} else if (isKnownRoot && isUnmounting) {
		mountedRoots.delete(root);
	}
}

// Record a commit: keep fiberRoots in sync (add new roots, drop unmounted ones)
// and drive a profiling session when one is active. Shared by the installed
// hook's onCommitFiberRoot and the attach path's wrapper.
function recordCommitFiberRoot(
	fiberRoots: Map<number, Set<FiberRoot>>,
	profilingState: ProfilingState,
	rendererID: number,
	root: FiberRoot,
	schedulerPriority?: number,
): void {
	syncFiberRoots(fiberRoots, rendererID, root)

	if (profilingState.isActive && profilingState.onCommit != null) {
		profilingState.onCommit(rendererID, root, schedulerPriority);
	}
}

type ProfilingState = {
	isActive: boolean,
	currentTraceName: string | null,
	traces: Map<string, any>,
	onCommit:
	| ((
		rendererID: number,
		root: FiberRoot,
		schedulerPriority?: number | undefined,
	) => void)
	| null,
	onPostCommit: ((root: FiberRoot) => void) | null,
};

function gt(a: string = '', b: string = ''): boolean {
	return compareVersions(a, b) === 1;
}

function gte(a: string = '', b: string = ''): boolean {
	return compareVersions(a, b) > -1;
}

const CONCURRENT_MODE_NUMBER = 0xeacf;
const CONCURRENT_MODE_SYMBOL_STRING = 'Symbol(react.concurrent_mode)';

const CONTEXT_NUMBER = 0xeace;
const CONTEXT_SYMBOL_STRING = 'Symbol(react.context)';

const SERVER_CONTEXT_SYMBOL_STRING = 'Symbol(react.server_context)';

const DEPRECATED_ASYNC_MODE_SYMBOL_STRING = 'Symbol(react.async_mode)';

const FORWARD_REF_NUMBER = 0xead0;
const FORWARD_REF_SYMBOL_STRING = 'Symbol(react.forward_ref)';

const MEMO_NUMBER = 0xead3;
const MEMO_SYMBOL_STRING = 'Symbol(react.memo)';

const PROFILER_NUMBER = 0xead2;
const PROFILER_SYMBOL_STRING = 'Symbol(react.profiler)';

const PROVIDER_NUMBER = 0xeacd;
const PROVIDER_SYMBOL_STRING = 'Symbol(react.provider)';

const CONSUMER_SYMBOL_STRING = 'Symbol(react.consumer)';

const SCOPE_NUMBER = 0xead7;
const SCOPE_SYMBOL_STRING = 'Symbol(react.scope)';

const STRICT_MODE_NUMBER = 0xeacc;
const STRICT_MODE_SYMBOL_STRING = 'Symbol(react.strict_mode)';

const REACT_MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel');

const cachedDisplayNames: WeakMap<React.FunctionComponent, string> = new WeakMap();

function getWrappedDisplayName(
	outerType: unknown,
	innerType: any,
	wrapperName: string,
	fallbackName?: string,
): string {
	const displayName = (outerType as any)?.displayName;
	return (
		displayName || `${wrapperName}(${getDisplayName(innerType, fallbackName)})`
	);
}

function getDisplayName(
	type: React.FunctionComponent,
	fallbackName: string = 'Anonymous',
): string {
	const nameFromCache = cachedDisplayNames.get(type);
	if (nameFromCache != null) {
		return nameFromCache;
	}

	let displayName = fallbackName;

	// The displayName property is not guaranteed to be a string.
	// It's only safe to use for our purposes if it's a string.
	// github.com/facebook/react-devtools/issues/803
	if (typeof type.displayName === 'string') {
		displayName = type.displayName;
	} else if (typeof type.name === 'string' && type.name !== '') {
		displayName = type.name;
	}

	cachedDisplayNames.set(type, displayName);
	return displayName;
}

function getInternalReactConstants(version: string): {
	getDisplayNameForFiber: React.DevTools.getDisplayNameForFiberType,
	getTypeSymbol: React.DevTools.getTypeSymbolType,
	ReactPriorityLevels: ReactReconciler.ReactPriorityLevelsType,
	ReactTypeOfWork: React.DevTools.WorkTagMap,
	StrictModeBits: number,
	SuspenseyImagesMode: number,
} {
	// **********************************************************
	// The section below is copied from files in React repo.
	// Keep it in sync, and add version guards if it changes.
	//
	// Technically these priority levels are invalid for versions before 16.9,
	// but 16.9 is the first version to report priority level to DevTools,
	// so we can avoid checking for earlier versions and support pre-16.9 canary releases in the process.
	let ReactPriorityLevels: ReactReconciler.ReactPriorityLevelsType = {
		ImmediatePriority: 99,
		UserBlockingPriority: 98,
		NormalPriority: 97,
		LowPriority: 96,
		IdlePriority: 95,
		NoPriority: 90,
	};

	if (gt(version, '17.0.2')) {
		ReactPriorityLevels = {
			ImmediatePriority: 1,
			UserBlockingPriority: 2,
			NormalPriority: 3,
			LowPriority: 4,
			IdlePriority: 5,
			NoPriority: 0,
		};
	}

	let StrictModeBits = 0;
	if (gte(version, '18.0.0-alpha')) {
		// 18+
		StrictModeBits = 0b011000;
	} else if (gte(version, '16.9.0')) {
		// 16.9 - 17
		StrictModeBits = 0b1;
	} else if (gte(version, '16.3.0')) {
		// 16.3 - 16.8
		StrictModeBits = 0b10;
	}

	const SuspenseyImagesMode = 0b0100000;

	// eslint-disable-next-line no-useless-assignment -- False positive: the value assigned to 'ReactTypeOfWork' **is** used in subsequent statements.
	let ReactTypeOfWork: React.DevTools.WorkTagMap = null as never;

	// **********************************************************
	// The section below is copied from files in React repo.
	// Keep it in sync, and add version guards if it changes.
	//
	// TODO Update the gt() check below to be gte() whichever the next version number is.
	// Currently the version in Git is 17.0.2 (but that version has not been/may not end up being released).
	if (gt(version, '17.0.1')) {
		ReactTypeOfWork = {
			CacheComponent: 24, // Experimental
			ClassComponent: 1,
			ContextConsumer: 9,
			ContextProvider: 10,
			CoroutineComponent: -1, // Removed
			CoroutineHandlerPhase: -1, // Removed
			DehydratedSuspenseComponent: 18, // Behind a flag
			ForwardRef: 11,
			Fragment: 7,
			FunctionComponent: 0,
			HostComponent: 5,
			HostPortal: 4,
			HostRoot: 3,
			HostHoistable: 26, // In reality, 18.2+. But doesn't hurt to include it here
			HostSingleton: 27, // Same as above
			HostText: 6,
			IncompleteClassComponent: 17,
			IncompleteFunctionComponent: 28,
			IndeterminateComponent: 2, // removed in 19.0.0
			LazyComponent: 16,
			LegacyHiddenComponent: 23, // Does not exist in 18+ OSS but exists in fb builds
			MemoComponent: 14,
			Mode: 8,
			OffscreenComponent: 22, // Experimental in 17. Stable in 18+
			Profiler: 12,
			ScopeComponent: 21, // Experimental
			SimpleMemoComponent: 15,
			SuspenseComponent: 13,
			SuspenseListComponent: 19, // Experimental
			TracingMarkerComponent: 25, // Experimental - This is technically in 18 but we don't
			// want to fork again so we're adding it here instead
			YieldComponent: -1, // Removed
			Throw: 29,
			ViewTransitionComponent: 30, // Experimental
			ActivityComponent: 31,
		};
	} else if (gte(version, '17.0.0-alpha')) {
		ReactTypeOfWork = {
			CacheComponent: -1, // Doesn't exist yet
			ClassComponent: 1,
			ContextConsumer: 9,
			ContextProvider: 10,
			CoroutineComponent: -1, // Removed
			CoroutineHandlerPhase: -1, // Removed
			DehydratedSuspenseComponent: 18, // Behind a flag
			ForwardRef: 11,
			Fragment: 7,
			FunctionComponent: 0,
			HostComponent: 5,
			HostPortal: 4,
			HostRoot: 3,
			HostHoistable: -1, // Doesn't exist yet
			HostSingleton: -1, // Doesn't exist yet
			HostText: 6,
			IncompleteClassComponent: 17,
			IncompleteFunctionComponent: -1, // Doesn't exist yet
			IndeterminateComponent: 2,
			LazyComponent: 16,
			LegacyHiddenComponent: 24,
			MemoComponent: 14,
			Mode: 8,
			OffscreenComponent: 23, // Experimental
			Profiler: 12,
			ScopeComponent: 21, // Experimental
			SimpleMemoComponent: 15,
			SuspenseComponent: 13,
			SuspenseListComponent: 19, // Experimental
			TracingMarkerComponent: -1, // Doesn't exist yet
			YieldComponent: -1, // Removed
			Throw: -1, // Doesn't exist yet
			ViewTransitionComponent: -1, // Doesn't exist yet
			ActivityComponent: -1, // Doesn't exist yet
		};
	} else if (gte(version, '16.6.0-beta.0')) {
		ReactTypeOfWork = {
			CacheComponent: -1, // Doesn't exist yet
			ClassComponent: 1,
			ContextConsumer: 9,
			ContextProvider: 10,
			CoroutineComponent: -1, // Removed
			CoroutineHandlerPhase: -1, // Removed
			DehydratedSuspenseComponent: 18, // Behind a flag
			ForwardRef: 11,
			Fragment: 7,
			FunctionComponent: 0,
			HostComponent: 5,
			HostPortal: 4,
			HostRoot: 3,
			HostHoistable: -1, // Doesn't exist yet
			HostSingleton: -1, // Doesn't exist yet
			HostText: 6,
			IncompleteClassComponent: 17,
			IncompleteFunctionComponent: -1, // Doesn't exist yet
			IndeterminateComponent: 2,
			LazyComponent: 16,
			LegacyHiddenComponent: -1,
			MemoComponent: 14,
			Mode: 8,
			OffscreenComponent: -1, // Experimental
			Profiler: 12,
			ScopeComponent: -1, // Experimental
			SimpleMemoComponent: 15,
			SuspenseComponent: 13,
			SuspenseListComponent: 19, // Experimental
			TracingMarkerComponent: -1, // Doesn't exist yet
			YieldComponent: -1, // Removed
			Throw: -1, // Doesn't exist yet
			ViewTransitionComponent: -1, // Doesn't exist yet
			ActivityComponent: -1, // Doesn't exist yet
		};
	} else if (gte(version, '16.4.3-alpha')) {
		ReactTypeOfWork = {
			CacheComponent: -1, // Doesn't exist yet
			ClassComponent: 2,
			ContextConsumer: 11,
			ContextProvider: 12,
			CoroutineComponent: -1, // Removed
			CoroutineHandlerPhase: -1, // Removed
			DehydratedSuspenseComponent: -1, // Doesn't exist yet
			ForwardRef: 13,
			Fragment: 9,
			FunctionComponent: 0,
			HostComponent: 7,
			HostPortal: 6,
			HostRoot: 5,
			HostHoistable: -1, // Doesn't exist yet
			HostSingleton: -1, // Doesn't exist yet
			HostText: 8,
			IncompleteClassComponent: -1, // Doesn't exist yet
			IncompleteFunctionComponent: -1, // Doesn't exist yet
			IndeterminateComponent: 4,
			LazyComponent: -1, // Doesn't exist yet
			LegacyHiddenComponent: -1,
			MemoComponent: -1, // Doesn't exist yet
			Mode: 10,
			OffscreenComponent: -1, // Experimental
			Profiler: 15,
			ScopeComponent: -1, // Experimental
			SimpleMemoComponent: -1, // Doesn't exist yet
			SuspenseComponent: 16,
			SuspenseListComponent: -1, // Doesn't exist yet
			TracingMarkerComponent: -1, // Doesn't exist yet
			YieldComponent: -1, // Removed
			Throw: -1, // Doesn't exist yet
			ViewTransitionComponent: -1, // Doesn't exist yet
			ActivityComponent: -1, // Doesn't exist yet
		};
	} else {
		ReactTypeOfWork = {
			CacheComponent: -1, // Doesn't exist yet
			ClassComponent: 2,
			ContextConsumer: 12,
			ContextProvider: 13,
			CoroutineComponent: 7,
			CoroutineHandlerPhase: 8,
			DehydratedSuspenseComponent: -1, // Doesn't exist yet
			ForwardRef: 14,
			Fragment: 10,
			FunctionComponent: 1,
			HostComponent: 5,
			HostPortal: 4,
			HostRoot: 3,
			HostHoistable: -1, // Doesn't exist yet
			HostSingleton: -1, // Doesn't exist yet
			HostText: 6,
			IncompleteClassComponent: -1, // Doesn't exist yet
			IncompleteFunctionComponent: -1, // Doesn't exist yet
			IndeterminateComponent: 0,
			LazyComponent: -1, // Doesn't exist yet
			LegacyHiddenComponent: -1,
			MemoComponent: -1, // Doesn't exist yet
			Mode: 11,
			OffscreenComponent: -1, // Experimental
			Profiler: 15,
			ScopeComponent: -1, // Experimental
			SimpleMemoComponent: -1, // Doesn't exist yet
			SuspenseComponent: 16,
			SuspenseListComponent: -1, // Doesn't exist yet
			TracingMarkerComponent: -1, // Doesn't exist yet
			YieldComponent: 9,
			Throw: -1, // Doesn't exist yet
			ViewTransitionComponent: -1, // Doesn't exist yet
			ActivityComponent: -1, // Doesn't exist yet
		};
	}
	// **********************************************************
	// End of copied code.
	// **********************************************************

	function getTypeSymbol(type: any): symbol | string | number {
		const symbolOrNumber =
			typeof type === 'object' && type !== null ? type.$$typeof : type;

		return typeof symbolOrNumber === 'symbol'
			? symbolOrNumber.toString()
			: symbolOrNumber;
	}

	const {
		CacheComponent,
		ClassComponent,
		IncompleteClassComponent,
		IncompleteFunctionComponent,
		FunctionComponent,
		IndeterminateComponent,
		ForwardRef,
		HostRoot,
		HostHoistable,
		HostSingleton,
		HostComponent,
		HostPortal,
		HostText,
		Fragment,
		LazyComponent,
		LegacyHiddenComponent,
		MemoComponent,
		OffscreenComponent,
		Profiler,
		ScopeComponent,
		SimpleMemoComponent,
		SuspenseComponent,
		SuspenseListComponent,
		TracingMarkerComponent,
		Throw,
		ViewTransitionComponent,
		ActivityComponent,
	} = ReactTypeOfWork;

	function resolveFiberType(type: any) {
		const typeSymbol = getTypeSymbol(type);
		switch (typeSymbol) {
			case MEMO_NUMBER:
			case MEMO_SYMBOL_STRING:
				// recursively resolving memo type in case of memo(forwardRef(Component))
				return resolveFiberType(type.type);
			case FORWARD_REF_NUMBER:
			case FORWARD_REF_SYMBOL_STRING:
				return type.render;
			default:
				return type;
		}
	}

	// NOTICE Keep in sync with shouldFilterFiber() and other get*ForFiber methods
	function getDisplayNameForFiber(
		fiber: Fiber,
		shouldSkipForgetCheck: boolean = false,
	): string | null {
		const { elementType, type, tag } = fiber;

		let resolvedType = type;
		if (typeof type === 'object' && type !== null) {
			resolvedType = resolveFiberType(type);
		}

		// eslint-disable-next-line no-useless-assignment -- False positive: the value assigned to 'resolvedContext' **is** used in subsequent statements.
		let resolvedContext: any = null;
		if (
			!shouldSkipForgetCheck &&
			// @ts-expect-error -- the type of `updateQueue` is `unknown`
			(fiber.updateQueue?.memoCache != null ||
				(Array.isArray(fiber.memoizedState?.memoizedState) &&
					fiber.memoizedState.memoizedState[0]?.[REACT_MEMO_CACHE_SENTINEL]) ||
				fiber.memoizedState?.memoizedState?.[REACT_MEMO_CACHE_SENTINEL])
		) {
			const displayNameWithoutForgetWrapper = getDisplayNameForFiber(
				fiber,
				true,
			);
			if (displayNameWithoutForgetWrapper == null) {
				return null;
			}

			return `Forget(${displayNameWithoutForgetWrapper})`;
		}

		switch (tag) {
			// $FlowFixMe[invalid-compare]
			case ActivityComponent:
				return 'Activity';
			// $FlowFixMe[invalid-compare]
			case CacheComponent:
				return 'Cache';
			case ClassComponent:
			// $FlowFixMe[invalid-compare] -- falls through
			case IncompleteClassComponent:
			// $FlowFixMe[invalid-compare] -- falls through
			case IncompleteFunctionComponent:
			case FunctionComponent:
			case IndeterminateComponent:
				return getDisplayName(resolvedType);
			case ForwardRef:
				return getWrappedDisplayName(
					elementType,
					resolvedType,
					'ForwardRef',
					'Anonymous',
				);
			case HostRoot: {
				const fiberRoot = fiber.stateNode;
				if (fiberRoot != null && fiberRoot._debugRootType !== null) {
					return fiberRoot._debugRootType;
				}
				return null;
			}
			case HostComponent:
			// $FlowFixMe[invalid-compare] -- falls through
			case HostSingleton:
			// $FlowFixMe[invalid-compare] -- falls through
			case HostHoistable:
				return type;
			case HostPortal:
			case HostText:
				return null;
			case Fragment:
				return 'Fragment';
			// $FlowFixMe[invalid-compare]
			case LazyComponent:
				// This display name will not be user visible.
				// Once a Lazy component loads its inner component, React replaces the tag and type.
				// This display name will only show up in console logs when DevTools DEBUG mode is on.
				return 'Lazy';
			// $FlowFixMe[invalid-compare]
			case MemoComponent:
			// $FlowFixMe[invalid-compare] -- falls through
			case SimpleMemoComponent:
				// Display name in React does not use `Memo` as a wrapper but fallback name.
				return getWrappedDisplayName(
					elementType,
					resolvedType,
					'Memo',
					'Anonymous',
				);
			case SuspenseComponent:
				return 'Suspense';
			// $FlowFixMe[invalid-compare]
			case LegacyHiddenComponent:
				return 'LegacyHidden';
			// $FlowFixMe[invalid-compare]
			case OffscreenComponent:
				return 'Offscreen';
			// $FlowFixMe[invalid-compare]
			case ScopeComponent:
				return 'Scope';
			// $FlowFixMe[invalid-compare]
			case SuspenseListComponent:
				return 'SuspenseList';
			case Profiler:
				return 'Profiler';
			// $FlowFixMe[invalid-compare]
			case TracingMarkerComponent:
				return 'TracingMarker';
			// $FlowFixMe[invalid-compare]
			case ViewTransitionComponent:
				return 'ViewTransition';
			// $FlowFixMe[invalid-compare]
			case Throw:
				// This should really never be visible.
				return 'Error';
			default: {
				const typeSymbol = getTypeSymbol(type);

				switch (typeSymbol) {
					case CONCURRENT_MODE_NUMBER:
					case CONCURRENT_MODE_SYMBOL_STRING:
					case DEPRECATED_ASYNC_MODE_SYMBOL_STRING:
						return null;
					case PROVIDER_NUMBER:
					case PROVIDER_SYMBOL_STRING:
						// 16.3.0 exposed the context object as "context"
						// PR #12501 changed it to "_context" for 16.3.1+
						// NOTE Keep in sync with inspectElementRaw()
						resolvedContext = fiber.type._context || fiber.type.context;
						return `${resolvedContext.displayName || 'Context'}.Provider`;
					case CONTEXT_NUMBER:
					case CONTEXT_SYMBOL_STRING:
					case SERVER_CONTEXT_SYMBOL_STRING:
						if (
							fiber.type._context === undefined &&
							fiber.type.Provider === fiber.type
						) {
							// In 19+, Context.Provider === Context, so this is a provider.
							resolvedContext = fiber.type;
							return `${resolvedContext.displayName || 'Context'}.Provider`;
						}

						// 16.3-16.5 read from "type" because the Consumer is the actual context object.
						// 16.6+ should read from "type._context" because Consumer can be different (in DEV).
						// NOTE Keep in sync with inspectElementRaw()
						resolvedContext = fiber.type._context || fiber.type;

						// NOTE: TraceUpdatesBackendManager depends on the name ending in '.Consumer'
						// If you change the name, figure out a more resilient way to detect it.
						return `${resolvedContext.displayName || 'Context'}.Consumer`;
					case CONSUMER_SYMBOL_STRING:
						// 19+
						resolvedContext = fiber.type._context;
						return `${resolvedContext.displayName || 'Context'}.Consumer`;
					case STRICT_MODE_NUMBER:
					case STRICT_MODE_SYMBOL_STRING:
						return null;
					case PROFILER_NUMBER:
					case PROFILER_SYMBOL_STRING:
						return `Profiler(${fiber.memoizedProps.id})`;
					case SCOPE_NUMBER:
					case SCOPE_SYMBOL_STRING:
						return 'Scope';
					default:
						// Unknown element type.
						// This may mean a new element type that has not yet been added to DevTools.
						return null;
				}
			}
		}
	}

	return {
		getDisplayNameForFiber,
		getTypeSymbol,
		ReactPriorityLevels,
		ReactTypeOfWork,
		StrictModeBits,
		SuspenseyImagesMode,
	};
}
