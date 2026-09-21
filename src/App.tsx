import {
	useCallback,
	useReducer,
	useState,
	useTransition,
} from 'react'
import { doNothing } from 'remeda'

import { basicStateReducer, createStore } from './store'
import { StoreContext } from './StoreContext'
import { StoreNumbers } from './StoreNumbers'
import { StoreLetters } from './StoreLetters'

import './App.css'

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

function delay<T>(fn: () => T, ms?: number): Promise<T> {
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
	const [state, setState] = useReducer(basicStateReducer, initialState)

	const [store] = useState(() => createStore(initialState))

	const [, startTransition] = useTransition()

	const dispatch = useCallback((action: React.SetStateAction<State>) => {
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
					onClick={() => {
						dispatch(state => ({
							numbers: state.numbers.length !== 0 ? state.numbers.concat(' ') : state.numbers,
							letters: state.letters.length !== 0 ? state.letters.concat(' ') : state.letters,
						}))
						dispatch(concatNumber("1"))
						dispatch(concatLetter("A"))
						startTransition(async () => {
							dispatch(concatNumber("2"))
							dispatch(concatLetter("B"))
							await delay(doNothing, 300)
						})
						dispatch(concatNumber("3"))
						dispatch(concatLetter("C"))
						startTransition(async () => {
							dispatch(concatNumber("4"))
							dispatch(concatLetter("D"))
							await delay(doNothing, 300)
						})
						dispatch(concatNumber("5"))
						dispatch(concatLetter("E"))
					}}
				>
					Update
				</button>
				<button
					type="button"
					className="counter"
					onClick={() => {
						dispatch(state => ({
							...state,
							numbers: state.numbers.length !== 0 ? state.numbers.concat(' ') : state.numbers,
						}))
						dispatch(concatNumber("1"))
						startTransition(async () => {
							dispatch(concatNumber("2"))
							await delay(doNothing, 300)
						})
						dispatch(concatNumber("3"))
						startTransition(async () => {
							dispatch(concatNumber("4"))
							await delay(doNothing, 300)
						})
						dispatch(concatNumber("5"))
					}}
				>
					Update numbers
				</button>
				<button
					type="button"
					className="counter"
					onClick={() => {
						dispatch(state => ({
							...state,
							letters: state.letters.length !== 0 ? state.letters.concat(' ') : state.letters,
						}))
						dispatch(concatLetter("A"))
						startTransition(async () => {
							dispatch(concatLetter("B"))
							await delay(doNothing, 300)
						})
						dispatch(concatLetter("C"))
						startTransition(async () => {
							dispatch(concatLetter("D"))
							await delay(doNothing, 300)
						})
						dispatch(concatLetter("E"))
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
					<p>
						State numbers are "{state.numbers.join('')}"
					</p>
					<StoreNumbers />
					<p>
						State letters are "{state.letters.join('')}"
					</p>
					<StoreLetters />
				</StoreContext>
			</section>
		</>
	)
}

export default App
