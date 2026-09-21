import invariant from "tiny-invariant";

import { facade, type ReactRenderer } from "./facade";
import { getCurrentDispatcher } from "./getCurrentDispatcher";

function getRendererDispatcher(renderer: ReactRenderer): React.Dispatcher {
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

export function getCurrentRenderer(): ReactRenderer {
	const currentDispatcher = getCurrentDispatcher()

	let currentRenderer: ReactRenderer | null = null

	for (const renderer of facade.hook.renderers.values()) {
		if (getRendererDispatcher(renderer) === currentDispatcher) {
			currentRenderer = renderer
			break;
		}
	}

	return currentRenderer
}
