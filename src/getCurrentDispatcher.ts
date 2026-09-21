import React from 'react'
import invariant from 'tiny-invariant';

const reactSecretInternals =
	React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ??
	React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

export function getCurrentDispatcher() {
	invariant(reactSecretInternals)
	let dispatcher: React.Dispatcher | null = null
	if ('H' in reactSecretInternals) {
		dispatcher = reactSecretInternals.H
	} else if ('ReactCurrentDispatcher' in reactSecretInternals) {
		dispatcher = reactSecretInternals.ReactCurrentDispatcher.current
	}
	invariant(dispatcher)
	return dispatcher
}
