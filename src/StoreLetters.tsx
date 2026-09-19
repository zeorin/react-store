import { memo, use } from "react"
import { StoreContext } from "./StoreContext"
import invariant from "tiny-invariant"
import { useStore } from "./useStore"
import type { State } from "./App"
import { isShallowEqual } from "remeda"

function selectLetters(state: State) { return state.letters }

export const StoreLetters = memo(function StoreLetters() {
	const store = use(StoreContext)

	invariant(store)

	const letters = useStore(store, selectLetters, isShallowEqual)

	return (
		<p>
			Store letters are "{letters.join('')}"
		</p>
	)
})
