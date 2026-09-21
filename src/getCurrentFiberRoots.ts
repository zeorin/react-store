import type { FiberRoot } from "react-reconciler";
import invariant from "tiny-invariant";

import { getCurrentRenderer } from "./getCurrentRenderer"
import { facade } from "./facade"

const fiberRootsByContainer = new WeakMap<Element, FiberRoot>

// FIXME: On the initial render, the facade hasn't yet gotten a reference to the
// fiber roots, and we fall back to searching the DOM for them. This relies on
// implementation details that are arguably more brittle than what the facade
// uses. Figure out a way to access the fiber roots during the initial render.

export function getCurrentFiberRoots() {
	const currentRenderer = getCurrentRenderer()

	let currentFiberRoots: Set<FiberRoot> | null = null

	if (currentRenderer !== null) {
		let rendererId: number | null = null;

		for (const [id, renderer] of facade.hook.renderers) {
			if (renderer === currentRenderer) {
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

	// We've not been able to attach in time, walk the DOM to find the roots
	currentFiberRoots = new Set(
		Array.from(document.body.children)
			.filter(element => {
				const instanceKey = Object.keys(element).find(key => key.startsWith('__reactContainer$'))
				if (instanceKey == null) return false
				// @ts-expect-error -- shhh
				fiberRootsByContainer.set(element, element[instanceKey].stateNode as never)
				return true
			})
			.map(element => fiberRootsByContainer.get(element)!)
	)

	invariant(currentFiberRoots && currentFiberRoots.size > 0)

	return currentFiberRoots
}
