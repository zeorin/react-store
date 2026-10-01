import { useLayoutEffect } from "react";
import { doNothing } from "remeda";

export const useIsomorphicLayoutEffect =
	typeof document !== 'undefined'
		? useLayoutEffect
		: doNothing
