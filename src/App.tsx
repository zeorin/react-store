import { useDeferredValue, useEffect, useState, useTransition, type SetStateAction } from 'react'
import './App.css'
import { createStore } from './store'
import { useStore } from './useStore'

function sleep(ms: number) {
  const startTime = performance.now()
  while (performance.now() - startTime < ms) {
    // Do nothing
  }
}

function basicStateReducer<S>(state: S, action: SetStateAction<S>): S {
  return typeof action === 'function' ? (action as Extract<SetStateAction<S>, (...args: unknown[]) => never>)(state) : action;
}

function App() {
  const [store] = useState(() => createStore(basicStateReducer<string>, ''))

  const [stateString, setState] = useState('')
  const storeString = useStore(store)

  const [, startTransition] = useTransition()

  const deferredStoreString = useDeferredValue(storeString)

  useEffect(() => {
	console.log(
	  'deferredStoreString === store.getState(): %o %s %s',
	  deferredStoreString === store.getState(),
	  deferredStoreString,
	  store.getState()
	)
  }, [store, deferredStoreString])

  if (stateString !== "") {
	sleep(300)
  }

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
			setState(str => str + "A")
			store.dispatch(str => str + "A")

			startTransition(() => {
				setState(str => str + "B")
				store.dispatch(str => str + "B")
			})

			setState(str => str + "C")
			store.dispatch(str => str + "C")

			startTransition(() => {
				setState(str => str + "D")
				store.dispatch(str => str + "D")
			})

			setState(str => str + "E")
			store.dispatch(str => str + "E")
		  }}
        >
          Strings are "{stateString}", "{storeString}"
        </button>
        <button
          type="button"
          className="counter"
          onClick={() => {
			setState("")
			store.dispatch("")
		  }}
        >
          Reset
        </button>
      </section>
	</>
  )
}

export default App
