export const insertIntoArray = <
  Value
>({
  array,
  index,
  value,
}: {
  array: Value[],
  index: number,
  value: Value,
}) => (
  array
  .slice(
    0,
    index,
  )
  .concat(
    value,
    (
      array
      .slice(
        index
      )
    )
  )
)
