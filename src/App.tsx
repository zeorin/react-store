import { useCallback, useState, useTransition, type SetStateAction } from 'react'
import './App.css'
import { createStore } from './store'
import { StoreContext } from './StoreContext'
import { StoreNumbers } from './StoreNumbers'
import { StoreLetters } from './StoreLetters'

export type State = {
	numbers: string[]
	letters: string[]
}

const initialState: State = {
	numbers: [],
	letters: []
}

function concatNumber(x: string) {
	return (state: State): State => ({ ...state, numbers: state.numbers.concat(x) })
}

function concatLetter(x: string) {
	return (state: State): State => ({ ...state, letters: state.letters.concat(x) })
}

function delayed<T>(fn: () => T, ms?: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		setTimeout(() => {
			try {
				resolve(fn())
			} catch (error) {
				reject(error)
			}
		}, ms)
	})
}

function App() {
	const [state, setState] = useState(initialState)

	const [store] = useState(() => createStore(initialState))

	const [, startTransition] = useTransition()

	const dispatch = useCallback((action: SetStateAction<State>) => {
		setState(action)
		store.dispatch(action)
	}, [store])

	return (
		<>
			<section id="center">
				<div>
					<h1>useStore</h1>
					<p>
						<code>useStore</code> demo
					</p>
				</div>
				<button
					type="button"
					className="counter"
					onClick={async () => {
						dispatch(concatNumber("1"))
						startTransition(() => {
							dispatch(concatLetter("A"))
						})
						await delayed(() => {
							dispatch(concatLetter("B"))
							startTransition(() => {
								dispatch(concatNumber("2"))
							})
						}, 300)
						await delayed(() => {
							dispatch(concatNumber("3"))
							startTransition(() => {
								dispatch(concatLetter("C"))
							})
						}, 300)
						await delayed(() => {
							dispatch(concatLetter("D"))
							startTransition(() => {
								dispatch(concatNumber("4"))
							})
						}, 300)
						await delayed(() => {
							dispatch(concatNumber("5"))
							startTransition(() => {
								dispatch(concatLetter("E"))
							})
						}, 300)
					}}
				>
					Update
				</button>
				<button
					type="button"
					className="counter"
					onClick={async () => {
						dispatch(concatNumber("1"))
						startTransition(() => {
							dispatch(concatNumber("2"))
						})
						await delayed(() => {
							dispatch(concatNumber("3"))
							startTransition(() => {
								dispatch(concatNumber("4"))
							})
						}, 300)
						await delayed(() => {
							dispatch(concatNumber("5"))
						}, 300)
					}}
				>
					Update numbers
				</button>
				<button
					type="button"
					className="counter"
					onClick={async () => {
						dispatch(concatLetter("A"))
						startTransition(() => {
							dispatch(concatLetter("B"))
						})
						await delayed(() => {
							dispatch(concatLetter("C"))
							startTransition(() => {
								dispatch(concatLetter("D"))
							})
						}, 300)
						await delayed(() => {
							dispatch(concatLetter("E"))
						}, 300)
					}}
				>
					Update letters
				</button>
				<button
					type="button"
					className="counter"
					onClick={() => {
						setState(initialState)
						store.dispatch(initialState)
					}}
				>
					Reset
				</button>
				<StoreContext value={store}>
					<StoreNumbers />
					<p>
						State numbers are "{state.numbers.join('')}"
					</p>
					<StoreLetters />
					<p>
						State letters are "{state.letters.join('')}"
					</p>
				</StoreContext>
			</section>
		</>
	)
}

export default App
