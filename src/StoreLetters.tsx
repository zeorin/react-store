import { memo, use } from "react"
import invariant from "tiny-invariant"
import { isShallowEqual } from "remeda"

import { StoreContext } from "./StoreContext"
import type { State } from "./App"
import { useStoreWithSelector } from "./useStoreWithSelector"

function selectLetters(state: State) { return state.letters }

export const StoreLetters = memo(function StoreLetters() {
	console.log('rendering `StoreLetters`')
	const store = use(StoreContext)

	invariant(store)

	const letters = useStoreWithSelector(store, selectLetters, isShallowEqual)

	return (
		<p>
			Store letters are "{letters.join('')}"
		</p>
	)
})
