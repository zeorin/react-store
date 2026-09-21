declare const dispatcher: unique symbol

type SharedStateClient = {
	H: null | React.Dispatcher,
}

namespace React {
	export type Dispatcher = typeof dispatcher;
	const __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: SharedStateClient | undefined
	const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
		ReactCurrentDispatcher: React.RefObject<React.Dispatcher | null>
	} | undefined
}
