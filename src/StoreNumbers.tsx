import { memo, use } from "react"
import invariant from "tiny-invariant"
import { isShallowEqual } from "remeda"

import type { State } from "./App"
import { StoreContext } from "./StoreContext"
import { useStoreWithSelector } from "./useStoreWithSelector"

function selectNumbers(state: State) { return state.numbers }

export const StoreNumbers = memo(function StoreNumbers() {
	console.log('rendering `StoreNumbers`')

	const store = use(StoreContext)

	invariant(store)

	const numbers = useStoreWithSelector(store, selectNumbers, isShallowEqual)

	return (
		<p>
			Store numbers are "{numbers.join('')}"
		</p>
	)
})
