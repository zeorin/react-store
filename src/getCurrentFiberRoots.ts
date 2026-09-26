import type { Fiber, FiberRoot } from "react-reconciler";
import invariant from "tiny-invariant";

import { getCurrentRenderer } from "./getCurrentRenderer"
import { installFacade } from "./facade"
import { AsyncResource } from "./AsyncResource";
import { getReactDOMFiberRoots } from "./getReactDOMFiberRoots";

const facade = installFacade()

const resourceCache = new WeakMap<ReactReconciler.ReactRenderer, AsyncResource<Set<FiberRoot>>>

export function getCurrentFiberRoots(
	/**
	 * On the initial render in non-dev builds, the facade hasn't yet been able to
	 * get a reference to the fiber roots, and we have to fall back to a
	 * renderer-specific way of getting them.
	 */
	getRendererSpecificFiberRoots: () => Set<FiberRoot> | null = getReactDOMFiberRoots
): AsyncResource<Set<FiberRoot>> {
	const currentRenderer = getCurrentRenderer()
	invariant(currentRenderer)

	let resource = resourceCache.get(currentRenderer)

	if (!resource) {
		const controller = new AbortController()

		resource = new AsyncResource<Set<FiberRoot>>((resolve) => {
			const unsubscribe = facade.hook.sub('fiber-root-committed', () => {
				const currentFiberRoots = getFiberRootsFromRenderer(currentRenderer)
				if (!currentFiberRoots) return
				resolve(currentFiberRoots)
			})
			controller.signal.addEventListener('abort', () => {
				unsubscribe()
			})
		}).finally(() => {
			controller.abort()
		})

		const currentFiberRoots = getFiberRootsFromRenderer(currentRenderer)

		if (currentFiberRoots) {
			resource.resolve(currentFiberRoots)
		} else {
			const currentFiberRoots = getRendererSpecificFiberRoots()
			if (currentFiberRoots && currentFiberRoots.size > 0) {
				resource.resolve(currentFiberRoots)
			}
		}

		resourceCache.set(currentRenderer, resource)
	}

	return resource
}

/** A non-null return value indicates at least one fiber root was found */
function getFiberRootsFromRenderer(renderer: ReactReconciler.ReactRenderer): Set<FiberRoot> | null {
	let currentFiberRoots: Set<FiberRoot> | null = null

	if (renderer !== null) {
		let rendererId: number | null = null;

		for (const [id, renderer] of facade.hook.renderers) {
			if (renderer === renderer) {
				rendererId = id
				break
			}
		}

		if (rendererId !== null) {
			const fiberRoots = facade.fiberRoots.get(rendererId)

			if (fiberRoots !== undefined && fiberRoots.size > 0) {
				currentFiberRoots = fiberRoots
			}
		}
	}

	if (currentFiberRoots && currentFiberRoots.size > 0) {
		return currentFiberRoots
	}

	return null
}
