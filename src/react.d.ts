/* eslint-disable @typescript-eslint/no-explicit-any */
declare const dispatcher: unique symbol

namespace React {
	export type Dispatcher = typeof dispatcher;
	export type LegacyDispatcherRef = { current: null | React.Dispatcher };
	export type CurrentDispatcherRef = { H: null | React.Dispatcher }
	const __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:
		| CurrentDispatcherRef
		| undefined
	const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED:
		| { ReactCurrentDispatcher: LegacyDispatcherRef }
		| undefined

	export namespace DevTools {
		export type RendererID = number;

		type Handler = (data: any) => void;

		export type Hook = {
			listeners: { [key: string]: Array<Handler> },
			rendererInterfaces: Map<RendererID, RendererInterface>,
			renderers: Map<RendererID, ReactReconciler.ReactRenderer>,
			hasUnsupportedRendererAttached: boolean,
			backends: Map<string, any>,

			emit: (event: string, data: any) => void,
			getFiberRoots: (rendererID: RendererID) => Set<ReactReconciler.FiberRoot>,
			inject: (renderer: ReactReconciler.ReactRenderer) => number | null,
			on: (event: string, handler: Handler) => void,
			off: (event: string, handler: Handler) => void,
			reactDevtoolsAgent?: object | null | undefined,
			sub: (event: string, handler: Handler) => () => void,
			
			supportsFiber?: boolean,
			supportsFlight?: boolean,

			// React uses these methods.
			checkDCE: (fn: () => void) => void,
			onScheduleFiberRoot: (rendererID: RendererED, fiber: FiberRoot, children: React.ReactNode) => void,
			onCommitFiberUnmount: (rendererID: RendererID, fiber: ReactReconciler.Fiber) => void,
			onCommitFiberRoot: (
				rendererID: RendererID,
				fiber: ReactReconciler.FiberRoot,
				// Added in v16.9 to support Profiler priority labels
				commitPriority?: number,
				// Added in v16.9 to support Fast Refresh
				didError?: boolean,
			) => void,
			onPostCommitFiberRoot: (
				rendererID: number,
				fiber: ReactReconciler.FiberRoot
			) => void

			settings?: Readonly<HookSettings>,
		};

		export type HookSettings = {
			appendComponentStack: boolean,
			breakOnConsoleErrors: boolean,
			showInlineWarningsAndErrors: boolean,
			hideConsoleLogsInStrictMode: boolean,
			disableSecondConsoleLogDimmingInStrictMode: boolean,
		};

		type Type = 'props' | 'hooks' | 'state' | 'context';

		type FindHostInstancesForElementID = (
			id: number,
		) => null | ReadonlyArray<ReactReconciler.HostInstance>;

		type Rect = {
			x: number,
			y: number,
			width: number,
			height: number,
		};

		type FindLastKnownRectsForID = (
			id: number,
		) => null | ReadonlyArray<Rect>;

		type PathMatch = {
			id: number,
			isFullMatch: boolean,
		};

		type GetComponentStack = (
			topFrame: Error,
		) => null | { enableOwnerStacks: boolean, componentStack: string };

		type GetElementIDForHostInstance = (
			component: ReactReconciler.HostInstance,
		) => number | null;

		type GetDisplayNameForElementID = (id: number) => string | null;

		type InstanceAndStyle = {
			instance: object | null,
			style: object | null,
		};

		type ChangeDescription = {
			context: Array<string> | boolean | null,
			didHooksChange: boolean,
			isFirstMount: boolean,
			props: Array<string> | null,
			state: Array<string> | null,
			hooks?: Array<number> | null,
		};


		// Different types of elements displayed in the Elements tree.
		// These types may be used to visually distinguish types,
		// or to enable/disable certain functionality.
		type ElementType =
			| 1
			| 2
			| 5
			| 6
			| 7
			| 8
			| 9
			| 10
			| 11
			| 12
			| 13
			| 14
			| 15
			| 16
			| 17;

		type SerializedElement = {
			displayName: string | null,
			id: number,
			key: number | string | null,
			env: null | string,
			stack: null | ReactReconciler.ReactStackTrace,
			type: ElementType,
		};

		type CommitDataBackend = {
			// Tuple of fiber ID and change description
			changeDescriptions: Array<[number, ChangeDescription]> | null,
			duration: number,
			// Only available in certain (newer) React builds,
			effectDuration: number | null,
			// Tuple of fiber ID and actual duration
			fiberActualDurations: Array<[number, number]>,
			// Tuple of fiber ID and computed "self" duration
			fiberSelfDurations: Array<[number, number]>,
			// Only available in certain (newer) React builds,
			passiveEffectDuration: number | null,
			priorityLevel: string | null,
			timestamp: number,
			updaters: Array<SerializedElement> | null,
		};

		type ProfilingDataForRootBackend = {
			commitData: Array<CommitDataBackend>,
			displayName: string,
			// Tuple of ReactReconciler.Fiber ID and base duration
			initialTreeBaseDurations: Array<[number, number]>,
			rootID: number,
		};

		// Profiling data collected by the renderer interface.
		// This information will be passed to the frontend and combined with info it collects.
		type ProfilingDataBackend = {
			dataForRoots: Array<ProfilingDataForRootBackend>,
			rendererID: number,
		};

		type PathFrame = {
			key: string | null,
			index: number,
			displayName: string | null,
		};

		type StyleXPlugin = {
			sources: Array<string>,
			resolvedStyles: object,
		};

		type Plugins = {
			stylex: StyleXPlugin | null,
		};

		type OnErrorOrWarning = (
			type: 'error' | 'warn',
			args: Array<any>,
		) => void;

		export type RendererInterface = {
			cleanup: () => void,
			clearErrorsAndWarnings: () => void,
			clearErrorsForElementID: (id: number) => void,
			clearWarningsForElementID: (id: number) => void,
			deletePath: (
				type: Type,
				id: number,
				hookID: number | null | undefined,
				path: Array<string | number>,
			) => void,
			findHostInstancesForElementID: FindHostInstancesForElementID,
			findLastKnownRectsForID: FindLastKnownRectsForID,
			flushInitialOperations: () => void,
			getBestMatchForTrackedPath: () => PathMatch | null,
			getComponentStack?: GetComponentStack,
			getNearestMountedDOMNode: (component: Element) => Element | null,
			getElementIDForHostInstance: GetElementIDForHostInstance,
			getSuspenseNodeIDForHostInstance: GetElementIDForHostInstance,
			getDisplayNameForElementID: GetDisplayNameForElementID,
			getInstanceAndStyle(id: number): InstanceAndStyle,
			getProfilingData(): ProfilingDataBackend,
			getOwnersList: (id: number) => Array<SerializedElement> | null,
			getPathForElement: (id: number) => Array<PathFrame> | null,
			getSerializedElementValueByPath: (
				id: number,
				path: Array<string | number>,
			) => string | null | undefined,
			handleCommitFiberRoot: (fiber: ReactReconciler.Fiber, commitPriority?: number) => void,
			handleCommitFiberUnmount: (fiber: ReactReconciler.Fiber) => void,
			handlePostCommitFiberRoot: (fiber: ReactReconciler.Fiber) => void,
			hasElementWithId: (id: number) => boolean,
			inspectElement: (
				requestID: number,
				id: number,
				inspectedPaths: object,
				forceFullData: boolean,
			) => InspectedElementPayload,
			logElementToConsole: (id: number) => void,
			onErrorOrWarning?: OnErrorOrWarning,
			overrideError: (id: number, forceError: boolean) => void,
			overrideSuspense: (id: number, forceFallback: boolean) => void,
			overrideSuspenseMilestone: (suspendedSet: Array<number>) => void,
			overrideValueAtPath: (
				type: Type,
				id: number,
				hook: number | null | undefined,
				path: Array<string | number>,
				value: any,
			) => void,
			getElementAttributeByPath: (
				id: number,
				path: Array<string | number>,
			) => unknown,
			getElementSourceFunctionById: (id: number) => null | ((...args: any[]) => never),
			renamePath: (
				type: Type,
				id: number,
				hookID: number | null | undefined,
				oldPath: Array<string | number>,
				newPath: Array<string | number>,
			) => void,
			renderer: ReactReconciler.ReactRenderer | null,
			setTraceUpdatesEnabled: (enabled: boolean) => void,
			setTrackedPath: (path: Array<PathFrame> | null) => void,
			startProfiling: (recordChangeDescriptions: boolean) => void,
			stopProfiling: () => void,
			storeAsGlobal: (
				id: number,
				path: Array<string | number>,
				count: number,
			) => void,
			supportsTogglingSuspense: boolean,
			updateComponentFilters: (componentFilters: Array<ComponentFilter>) => void,
			getEnvironmentNames: () => Array<string>,
		};

		export type RendererInternals = {
			getDisplayNameForFiber: getDisplayNameForFiberType,
			ReactTypeOfWork: WorkTagMap,
			ReactPriorityLevels: ReactReconciler.ReactPriorityLevelsType,
			currentDispatcherRef: React.CurrentDispatcherRef,
		};

		export type getDisplayNameForFiberType = (fiber: ReactReconciler.Fiber) => string | null;
		export type getTypeSymbolType = (type: any) => symbol | string | number;

		type UnknownSuspendersReason = any

		type ReactFunctionLocation = [
			fnName: string,
			fileName: string,
			enclosingLineNo: number,
			enclosingColumnNo: number,
		];

		type InspectedElement = {
			id: number,

			// Does the current renderer support editable hooks and function props?
			canEditHooks: boolean,
			canEditFunctionProps: boolean,

			// Does the current renderer support advanced editing interface?
			canEditHooksAndDeletePaths: boolean,
			canEditHooksAndRenamePaths: boolean,
			canEditFunctionPropsDeletePaths: boolean,
			canEditFunctionPropsRenamePaths: boolean,

			// Is this Error, and can its value be overridden now?
			canToggleError: boolean,
			isErrored: boolean,

			// Is this Suspense, and can its value be overridden now?
			canToggleSuspense: boolean,
			// If this Element is suspended. Currently only set on Suspense boundaries.
			isSuspended: boolean | null,

			// Does the component have legacy context attached to it.
			hasLegacyContext: boolean,

			// Inspectable properties.
			context: object | null, // DehydratedData or {[string]: mixed}
			hooks: object | null, // DehydratedData or {[string]: mixed}
			props: object | null, // DehydratedData or {[string]: mixed}
			state: object | null, // DehydratedData or {[string]: mixed}
			key: number | string | null,
			errors: Array<[string, number]>,
			warnings: Array<[string, number]>,

			// Things that suspended this Instances
			suspendedBy: object, // DehydratedData or Array<SerializedAsyncInfo>
			suspendedByRange: null | [number, number],
			unknownSuspenders: UnknownSuspendersReason,

			// List of owners
			owners: Array<SerializedElement> | null,

			// Environment name that this component executed in or null for the client
			env: string | null,

			source: ReactFunctionLocation | null,

			// The location of the JSX creation.
			stack: ReactReconciler.ReactStackTrace | null,

			type: ElementType,

			// Meta information about the root this element belongs to.
			rootType: string | null,

			// Meta information about the renderer that created this element.
			rendererPackageName: string | null,
			rendererVersion: string | null,

			// UI plugins/visualizations for the inspected element.
			plugins: Plugins,

			// React Native only.
			nativeTag: number | null,
		};

		type InspectElementError = {
			id: number,
			responseID: number,
			type: 'error',
			errorType: 'user' | 'unknown-hook' | 'uncaught',
			message: string,
			stack?: string,
		};

		type InspectElementFullData = {
			id: number,
			responseID: number,
			type: 'full-data',
			value: InspectedElement,
		};

		type InspectElementHydratedPath = {
			id: number,
			responseID: number,
			type: 'hydrated-path',
			path: Array<string | number>,
			value: any,
		};

		type InspectElementNoChange = {
			id: number,
			responseID: number,
			type: 'no-change',
		};

		type InspectElementNotFound = {
			id: number,
			responseID: number,
			type: 'not-found',
		};

		type InspectedElementPayload =
			| InspectElementError
			| InspectElementFullData
			| InspectElementHydratedPath
			| InspectElementNoChange
			| InspectElementNotFound;

		// Hide all elements of types in this Set.
		// We hide host components only by default.
		type ElementTypeComponentFilter = {
			isEnabled: boolean,
			type: 1,
			value: ElementType,
		};

		// Hide all elements with displayNames or paths matching one or more of the RegExps in this Set.
		// Path filters are only used when elements include debug source location.
		type RegExpComponentFilter = {
			isEnabled: boolean,
			isValid: boolean,
			type: 2 | 3,
			value: string,
		};

		type BooleanComponentFilter = {
			isEnabled: boolean,
			isValid: boolean,
			type: 4,
		};

		type EnvironmentNameComponentFilter = {
			isEnabled: boolean,
			isValid: boolean,
			type: 5,
			value: string,
		};

		type ActivitySliceFilter = {
			type: 6,
			activityID: Element['id'],
			rendererID: number,
			isValid: boolean,
			isEnabled: boolean,
		};

		type ComponentFilter =
			| BooleanComponentFilter
			| ElementTypeComponentFilter
			| RegExpComponentFilter
			| EnvironmentNameComponentFilter
			| ActivitySliceFilter;

		export type WorkTag = number;
		export type WorkFlags = number;
		export type ExpirationTime = number;

		export type WorkTagMap = {
			CacheComponent: WorkTag,
			ClassComponent: WorkTag,
			ContextConsumer: WorkTag,
			ContextProvider: WorkTag,
			CoroutineComponent: WorkTag,
			CoroutineHandlerPhase: WorkTag,
			DehydratedSuspenseComponent: WorkTag,
			ForwardRef: WorkTag,
			Fragment: WorkTag,
			FunctionComponent: WorkTag,
			HostComponent: WorkTag,
			HostPortal: WorkTag,
			HostRoot: WorkTag,
			HostHoistable: WorkTag,
			HostSingleton: WorkTag,
			HostText: WorkTag,
			IncompleteClassComponent: WorkTag,
			IncompleteFunctionComponent: WorkTag,
			IndeterminateComponent: WorkTag,
			LazyComponent: WorkTag,
			LegacyHiddenComponent: WorkTag,
			MemoComponent: WorkTag,
			Mode: WorkTag,
			OffscreenComponent: WorkTag,
			Profiler: WorkTag,
			ScopeComponent: WorkTag,
			SimpleMemoComponent: WorkTag,
			SuspenseComponent: WorkTag,
			SuspenseListComponent: WorkTag,
			TracingMarkerComponent: WorkTag,
			YieldComponent: WorkTag,
			Throw: WorkTag,
			ViewTransitionComponent: WorkTag,
			ActivityComponent: WorkTag,
		};
	}
}



namespace ReactReconciler {
	interface ConsoleTask {
		run<T>(f: () => T): T;
	}

	export type ReactPriorityLevelsType = {
		ImmediatePriority: number,
		UserBlockingPriority: number,
		NormalPriority: number,
		LowPriority: number,
		IdlePriority: number,
		NoPriority: number,
	};

	export type ReactOptimisticKey = symbol

	export type ReactKey = null | string | ReactOptimisticKey;

	export type ReactComponentInfo = {
		readonly name: string,
		readonly env?: string,
		readonly key?: ReactKey,
		readonly owner?: null | ReactComponentInfo,
		readonly stack?: null | ReactStackTrace,
		readonly props?: null | { [name: string]: unknown },
		// Stashed Data for the Specific Execution Environment. Not part of the transport protocol
		readonly debugStack?: null | Error,
		readonly debugTask?: null | ConsoleTask,
		debugLocation?: null | Error,
	};

	export type ReactCallSite = [
		fnName: string,
		fileName: string,
		lineNo: number,
		colNo: number,
		enclosingLineNo: number,
		enclosingColNo: number,
		asyncResume: boolean,
	];

	export type ReactStackTrace = Array<ReactCallSite>;

	export type HostInstance = object

	export type BundleType =
		| 0 // PROD
		| 1; // DEV

	export type ReactRenderer = {
		version: string,
		rendererPackageName: string,
		bundleType: BundleType,
		// 16.0+ - To be removed in future versions.
		findFiberByHostInstance?: ((hostInstance: ReactReconciler.HostInstance) => ReactReconciler.Fiber | null) | null | undefined,
		// 16.9+
		overrideHookState?: ((
			fiber: ReactReconciler.Fiber,
			id: number,
			path: Array<string | number>,
			value: any,
		) => void) | null | undefined,
		// 17+
		overrideHookStateDeletePath?: ((
			fiber: ReactReconciler.Fiber,
			id: number,
			path: Array<string | number>,
		) => void) | null | undefined,
		// 17+
		overrideHookStateRenamePath?: ((
			fiber: ReactReconciler.Fiber,
			id: number,
			oldPath: Array<string | number>,
			newPath: Array<string | number>,
		) => void) | null | undefined,
		// 16.7+
		overrideProps?: ((
			fiber: ReactReconciler.Fiber,
			path: Array<string | number>,
			value: any,
		) => void) | null | undefined,
		// 17+
		overridePropsDeletePath?: ((
			fiber: ReactReconciler.Fiber,
			path: Array<string | number>,
		) => void) | null | undefined,
		// 17+
		overridePropsRenamePath?: ((
			fiber: ReactReconciler.Fiber,
			oldPath: Array<string | number>,
			newPath: Array<string | number>,
		) => void) | null | undefined,
		// 16.9+
		scheduleUpdate?: ((fiber: ReactReconciler.Fiber) => void) | null | undefined,
		// 19.2+
		scheduleRetry?: ((fiber: ReactReconciler.Fiber) => void) | null | undefined,
		setSuspenseHandler?: ((shouldSuspend: (fiber: ReactReconciler.Fiber) => boolean) => void) | null | undefined,
		// Only injected by React v16.8+ in order to support hooks inspection.
		currentDispatcherRef?: React.LegacyDispatcherRef | React.CurrentDispatcherRef,
		// Only injected by React v16.9+ in DEV mode.
		// Enables DevTools to append owners-only component stack to error messages.
		getCurrentFiber?: (() => ReactReconciler.Fiber | null) | null,
		// Only injected by React Flight Clients in DEV mode.
		// Enables DevTools to append owners-only component stack to error messages from Server Components.
		getCurrentComponentInfo?: () => ReactComponentInfo | null,
		// 17.0.2+
		reconcilerVersion?: string,
		// Uniquely identifies React DOM v15.
		ComponentTree?: any,
		// Present for React DOM v12 (possibly earlier) through v15.
		Mount?: any,
		// Only injected by React v17.0.3+ in DEV mode
		setErrorHandler?: ((shouldError: (fiber: ReactReconciler.Fiber) => boolean | null | undefined) => void) | null | undefined,
	};
}
