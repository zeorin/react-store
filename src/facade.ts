/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FiberRoot } from 'react-reconciler';

type LegacyDispatcherRef = { current: null | React.Dispatcher };
type CurrentDispatcherRef = { H: null | React.Dispatcher }

type Handler = (data: any) => void;

export type ReactRenderer = {
  // Only injected by React v16.8+ in order to support hooks inspection.
  currentDispatcherRef?: LegacyDispatcherRef | CurrentDispatcherRef,
};

type DevToolsHook = {
  listeners: { [key: string]: Array<Handler> },
  rendererInterfaces: Map<number, any>,
  renderers: Map<number, ReactRenderer>,
  hasUnsupportedRendererAttached: boolean,
  backends: Map<string, any>,

  emit: (event: string, data: any) => void,
  getFiberRoots: (rendererID: number) => Set<object>,
  inject: (renderer: ReactRenderer) => number | null,
  on: (event: string, handler: Handler) => void,
  off: (event: string, handler: Handler) => void,
  sub: (event: string, handler: Handler) => () => void,

  // React uses these methods.
  checkDCE: (checkDCE: () => void) => void,
  onCommitFiberUnmount: (rendererID: number, fiber: object) => void,
  onCommitFiberRoot: (
    rendererID: number,
    fiber: object,
    commitPriority?: number,
    didError?: boolean,
  ) => void,
	onPostCommitFiberRoot: (
		rendererID: number,
		fiber: object
	) => void

	supportsFiber?: boolean;
	supportsFlight?: boolean;
};

type Facade = {
	hook: DevToolsHook,
	fiberRoots: Map<number, Set<FiberRoot>>,
};

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

function attachToExistingHook(
	hook: DevToolsHook,
	fiberRoots: Map<number, Set<FiberRoot>>,
): void {
	// Back-fill renderers and roots registered before we attached (React may have
	// initialized first).
	if (hook.renderers instanceof Map) {
		Array.from(hook.renderers.entries(), ([id]) => {
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
		syncFiberRoots(
			fiberRoots,
			rendererID,
			root,
		);
	};
}

type FacadeTarget = {
	__REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook
}

declare global {
	var __REACT_DEVTOOLS_GLOBAL_HOOK__: DevToolsHook | undefined
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

	// A hook is already installed (e.g. the React DevTools extension). Attach to
	// it rather than replacing it.
	const existingHook = target.__REACT_DEVTOOLS_GLOBAL_HOOK__;
	if (existingHook != null) {
		attachToExistingHook(
			existingHook,
			fiberRoots,
		);
		return { hook: existingHook, fiberRoots };
	}

	let registeredRenderersCount = 0;

	const hook = {
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
		inject(renderer: ReactRenderer): number {
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
		onCommitFiberRoot(
			rendererID: number,
			root: FiberRoot,
		) {
			syncFiberRoots(
				fiberRoots,
				rendererID,
				root,
			);
		},
		onCommitFiberUnmount() {},
		onPostCommitFiberRoot() {},
	};

	Object.defineProperty(target, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
		configurable: import.meta.env.DEV,
		enumerable: false,
		get() {
			return hook;
		},
	});

	return { hook, fiberRoots };
}

const facade = installFacade()

export { facade }
