import invariant from "tiny-invariant";

import { installFacade } from "./facade";
import { getCurrentDispatcher } from "./getCurrentDispatcher";

const facade = installFacade()

export function getCurrentRenderer(): ReactReconciler.ReactRenderer | null {
	const currentDispatcher = getCurrentDispatcher()

	let currentRenderer: ReactReconciler.ReactRenderer | null = null

	for (const renderer of facade.hook.renderers.values()) {
		if (getRendererDispatcher(renderer) === currentDispatcher) {
			currentRenderer = renderer
			break;
		}
	}

	return currentRenderer
}

function getRendererDispatcher(renderer: ReactReconciler.ReactRenderer): React.Dispatcher {
	let dispatcher: React.Dispatcher | null = null

	invariant(renderer.currentDispatcherRef)
	if ('H' in renderer.currentDispatcherRef) {
		dispatcher = renderer.currentDispatcherRef.H
	} else if ('current' in renderer.currentDispatcherRef) {
		dispatcher = renderer.currentDispatcherRef.current
	}

	invariant(dispatcher)

	return dispatcher
}
