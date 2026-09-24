/* eslint-disable @typescript-eslint/no-explicit-any */

import "vitest";

interface CustomMatchers<R = unknown> {
  toOnlyRerenderWhenPromiseChanges: () => R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
