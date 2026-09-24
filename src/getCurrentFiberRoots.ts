import type { Fiber, FiberRoot } from "react-reconciler";
import invariant from "tiny-invariant";

import { getCurrentRenderer } from "./getCurrentRenderer"
import { facade } from "./facade"

export function getCurrentFiberRoots(
	/**
	 * On the initial render in non-dev builds, the facade hasn't yet been able to
	 * get a reference to the fiber roots, and we have to fall back to a
	 * renderer-specific way of getting them.
	 */
	getRendererSpecificFiberRoots: () => FiberRoot[] = getReactDOMFiberRoots
) {
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
	currentFiberRoots = new Set(getRendererSpecificFiberRoots())

	invariant(currentFiberRoots.size > 0)

	return currentFiberRoots
}

const reactDOMContainerInstanceKeyPrefix = '__reactContainer$' as const

const HostComponent = 5;
const HostHoistable = 26;
const HostSingleton = 27;
const HostText = 6;
// Root of a host tree. Could be nested inside another node.
const HostRoot = 3;
const SuspenseComponent = 13;
const ActivityComponent = 31;

function getInstanceFromDOMNode(node: Node): Fiber | null {
  let inst: Fiber | null = null;
	for (const key in node) {
		if (key.startsWith(reactDOMContainerInstanceKeyPrefix)) {
			// @ts-expect-error -- shhh
			inst = node[key]
		}
	}
  if (inst) {
    const tag = inst.tag;
    if (
      tag === HostComponent ||
      tag === HostText ||
      tag === SuspenseComponent ||
			// @ts-expect-error -- types are a little out of date
      tag === ActivityComponent ||
			// @ts-expect-error -- types are a little out of date
      tag === HostHoistable ||
			// @ts-expect-error -- types are a little out of date
      tag === HostSingleton ||
      tag === HostRoot
    ) {
      return inst;
    } else {
      return null;
    }
  }
  return null;
}

function getRootInstanceFromDOMNode(node: Node | null): Fiber | null {
	if (node === null) {
		return null
	}
	const fiber = getInstanceFromDOMNode(node)
	if (fiber === null || fiber.tag !== HostRoot) {
		return null
	}
	return fiber
}

/**
 * Technically, we only get the *first* fiber root. We just return it as an array
 */
function getReactDOMFiberRoots(): FiberRoot[] {
	const nodeIterator = document.createNodeIterator(
		document,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_DOCUMENT | NodeFilter.SHOW_DOCUMENT_FRAGMENT
	)
	let fiberRoot: FiberRoot | null = null;
	// eslint-disable-next-line no-useless-assignment -- False positive, the value **is** used in subsequent statements
	let currentNode: Node | null = null;
	while ((currentNode = nodeIterator.nextNode())) {
		const fiber = getRootInstanceFromDOMNode(currentNode)
		if (fiber !== null) {
			fiberRoot = fiber.stateNode
			break
		}
	}
	return [fiberRoot].filter(Boolean)
}
