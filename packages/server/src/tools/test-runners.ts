import { firstValueFrom, from, iif, Observable, Observer, of, OperatorFunction } from "rxjs";
import { RunHelpers, TestScheduler } from "rxjs/testing"
import { expect } from "vitest";

export const getOperatorValue = <
  InputValue,
  OutputValue
>(
  operator: (
    OperatorFunction<
      InputValue,
      OutputValue
    >
  ),
  ...inputValues: (
    InputValue[]
  )
) => (
  firstValueFrom(
    of(
      ...inputValues
    )
    .pipe(
      operator,
    )
  )
)

export const runPromiseScheduler = <ObservableValue>({
  getSubscriber,
  observable,
}: {
  getSubscriber: (
    resolve: () => void,
    reject: () => void,
  ) => (
    Observer<
      ObservableValue
    >
  ),
  observable: (
    Observable<
      ObservableValue
    >
  ),
}) => (
  new Promise<void>((resolve, reject) => {
    observable
    .subscribe(
      getSubscriber(resolve, reject)
    )
  })
)

export const runTestScheduler = <
  ReturnValue
>(
  testRunner: (
    helpers: RunHelpers,
  ) => (
    ReturnValue
  )
) => {
  const testScheduler = (
    new TestScheduler((
      actual,
      expected,
    ) => {
      expect(
        actual
      )
      .toEqual(
        expected
      );
    })
  )

  return (
    testScheduler
    .run<
      ReturnValue
    >(
      testRunner
    )
  )
}
