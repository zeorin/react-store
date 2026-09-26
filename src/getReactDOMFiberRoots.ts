import type { Fiber, FiberRoot } from "react-reconciler";

const reactDOMContainerInstanceKeyPrefix = '__reactContainer$' as const

const HostComponent = 5;
const HostHoistable = 26;
const HostSingleton = 27;
const HostText = 6;
// Root of a host tree. Could be nested inside another node.
const HostRoot = 3;
const SuspenseComponent = 13;
const ActivityComponent = 31;

/**
 * Technically, we only get the *first* fiber root.
 */
export function getReactDOMFiberRoots(): Set<FiberRoot> | null  {
	if (typeof document === 'undefined') return null

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

	if (fiberRoot === null) return null

	return new Set([fiberRoot])
}

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
