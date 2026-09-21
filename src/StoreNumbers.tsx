import { memo, use } from "react"
import invariant from "tiny-invariant"
import { isShallowEqual } from "remeda"

import { useStore } from "./useStore"
import type { State } from "./App"
import { StoreContext } from "./StoreContext"

function selectNumbers(state: State) { return state.numbers }

export const StoreNumbers = memo(function StoreNumbers() {
	const store = use(StoreContext)

	invariant(store)

	const numbers = useStore(store, selectNumbers, isShallowEqual)

	return (
		<p>
			Store numbers are "{numbers.join('')}"
		</p>
	)
})
