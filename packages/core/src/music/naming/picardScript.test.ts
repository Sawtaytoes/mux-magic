import { describe, expect, test } from "vitest"

import { DEFAULT_NAMING_SCRIPT } from "./defaultNamingScript.js"
import { evaluatePicardScript } from "./picardScript.js"

const run = ({
  script,
  variables = {},
}: {
  script: string
  variables?: Record<string, string>
}) => evaluatePicardScript({ script, variables })

describe("literal text and variables", () => {
  test("passes plain text through unchanged", () => {
    expect(run({ script: "Hello World" })).toBe(
      "Hello World",
    )
  })

  test("keeps a slash as literal text", () => {
    expect(run({ script: "one/two" })).toBe("one/two")
  })

  test("substitutes a variable", () => {
    expect(
      run({
        script: "%artist%",
        variables: { artist: "Boards of Canada" },
      }),
    ).toBe("Boards of Canada")
  })

  test("substitutes a variable whose name has an underscore", () => {
    expect(
      run({
        script: "%_multiartist%",
        variables: { _multiartist: "1" },
      }),
    ).toBe("1")
  })

  test("renders an unknown variable as an empty string", () => {
    expect(run({ script: "[%nosuchvariable%]" })).toBe("[]")
  })

  test("keeps a top-level comma and close paren as literal text", () => {
    expect(run({ script: "a,b)c" })).toBe("a,b)c")
  })
})

describe("escapes", () => {
  test("escapes a comma inside an argument", () => {
    expect(run({ script: "$if2(\\,,fallback)" })).toBe(",")
  })

  test("escapes parentheses, percent, dollar and backslash", () => {
    expect(run({ script: "\\(\\)\\%\\$\\\\" })).toBe(
      "()%$\\",
    )
  })

  test("escapes newline and tab", () => {
    expect(run({ script: "a\\nb\\tc" })).toBe("a\nb\tc")
  })

  test("rejects a trailing backslash", () => {
    expect(() => run({ script: "abc\\" })).toThrow(
      /trailing backslash/,
    )
  })
})

describe("$if", () => {
  test("returns the then branch when the condition is non-empty", () => {
    expect(run({ script: "$if(x,yes,no)" })).toBe("yes")
  })

  test("returns the else branch when the condition is empty", () => {
    expect(run({ script: "$if(%missing%,yes,no)" })).toBe(
      "no",
    )
  })

  test("returns an empty string when the else branch is omitted", () => {
    expect(run({ script: "$if(%missing%,yes)" })).toBe("")
  })

  test('treats "0" as TRUE, because only the empty string is false', () => {
    expect(
      run({
        script: "$if(%tracknumber%,yes,no)",
        variables: { tracknumber: "0" },
      }),
    ).toBe("yes")
  })

  test('treats "false" as TRUE as well', () => {
    expect(run({ script: "$if(false,yes,no)" })).toBe("yes")
  })
})

describe("$if2", () => {
  test("returns the first non-empty argument", () => {
    expect(
      run({
        script: "$if2(%albumartist%,%artist%,Unknown)",
        variables: { artist: "Aphex Twin" },
      }),
    ).toBe("Aphex Twin")
  })

  test("returns an empty string when every argument is empty", () => {
    expect(run({ script: "$if2(%a%,%b%)" })).toBe("")
  })
})

describe("boolean functions", () => {
  test("$and is true only when every argument is non-empty", () => {
    expect(run({ script: "$and(a,b)" })).toBe("1")
    expect(run({ script: "$and(a,%missing%)" })).toBe("")
  })

  test("$or is true when any argument is non-empty", () => {
    expect(run({ script: "$or(%missing%,b)" })).toBe("1")
    expect(
      run({ script: "$or(%missing%,%alsomissing%)" }),
    ).toBe("")
  })

  test("$not inverts emptiness", () => {
    expect(run({ script: "$not(%missing%)" })).toBe("1")
    expect(run({ script: "$not(a)" })).toBe("")
  })

  test('$and treats "0" as true', () => {
    expect(run({ script: "$and(0,0)" })).toBe("1")
  })
})

describe("comparison functions", () => {
  test("$eq and $ne compare as strings", () => {
    expect(run({ script: "$eq(abc,abc)" })).toBe("1")
    expect(run({ script: "$eq(abc,abd)" })).toBe("")
    expect(run({ script: "$ne(abc,abd)" })).toBe("1")
    expect(run({ script: "$ne(abc,abc)" })).toBe("")
  })

  test("$gt, $gte, $lt and $lte compare numerically", () => {
    expect(run({ script: "$gt(10,9)" })).toBe("1")
    expect(run({ script: "$gt(9,10)" })).toBe("")
    expect(run({ script: "$gte(9,9)" })).toBe("1")
    expect(run({ script: "$lt(2,10)" })).toBe("1")
    expect(run({ script: "$lte(10,10)" })).toBe("1")
  })

  test("a non-numeric operand makes the comparison false", () => {
    expect(run({ script: "$gt(abc,1)" })).toBe("")
    expect(run({ script: "$lt(abc,1)" })).toBe("")
    expect(run({ script: "$gt(%missing%,1)" })).toBe("")
  })
})

describe("$num", () => {
  test("zero-pads to the requested length", () => {
    expect(run({ script: "$num(5,2)" })).toBe("05")
    expect(run({ script: "$num(5,3)" })).toBe("005")
  })

  test("keeps a number that is longer than the requested length", () => {
    expect(run({ script: "$num(123,2)" })).toBe("123")
  })

  test("treats a non-numeric value as zero", () => {
    expect(run({ script: "$num(abc,2)" })).toBe("00")
    expect(run({ script: "$num(%missing%,2)" })).toBe("00")
  })
})

describe("string functions", () => {
  test("$left and $right take a substring", () => {
    expect(run({ script: "$left(hello,3)" })).toBe("hel")
    expect(run({ script: "$right(hello,3)" })).toBe("llo")
    expect(run({ script: "$right(hello,0)" })).toBe("")
  })

  test("$upper and $lower change case", () => {
    expect(run({ script: "$upper(Kid A)" })).toBe("KID A")
    expect(run({ script: "$lower(Kid A)" })).toBe("kid a")
  })

  test("$replace swaps every occurrence", () => {
    expect(run({ script: "$replace(a-b-c,-,_)" })).toBe(
      "a_b_c",
    )
  })

  test("$trim removes surrounding whitespace", () => {
    expect(run({ script: "$trim(  padded  )" })).toBe(
      "padded",
    )
  })

  test("$trim removes a given character from both ends", () => {
    expect(run({ script: "$trim(xxcorexx,x)" })).toBe(
      "core",
    )
  })
})

describe("nesting", () => {
  test("evaluates a function used as another function's argument", () => {
    expect(
      run({
        script: "$if($gt(%totaldiscs%,1),multi,single)",
        variables: { totaldiscs: "3" },
      }),
    ).toBe("multi")
  })

  test("evaluates three levels of nesting", () => {
    expect(
      run({
        script:
          "$upper($if($not(%missing%),$left(nested,3),no))",
      }),
    ).toBe("NES")
  })
})

describe("syntax errors", () => {
  test("throws on an unclosed argument list", () => {
    expect(() => run({ script: "$if(a,b" })).toThrow(
      /unclosed function argument list/,
    )
  })

  test("throws on an unclosed variable reference", () => {
    expect(() => run({ script: "%artist" })).toThrow(
      /unclosed variable reference/,
    )
  })

  test("throws on a dollar sign that is not a function call", () => {
    expect(() => run({ script: "$if" })).toThrow(
      /malformed function call/,
    )
  })

  test("throws on an unknown function rather than returning an empty string", () => {
    expect(() =>
      run({ script: "$nosuchfunction(a)" }),
    ).toThrow(/unknown function \$nosuchfunction/)
  })

  test("throws when a function gets too few arguments", () => {
    expect(() => run({ script: "$eq(a)" })).toThrow(
      /needs at least 2 arguments/,
    )
  })
})

describe(evaluatePicardScript.name, () => {
  test("evaluates the default naming script for a single-disc album", () => {
    expect(
      run({
        script: DEFAULT_NAMING_SCRIPT,
        variables: {
          _multiartist: "",
          album: "Album Name",
          albumartist: "Artist Name",
          artist: "Artist Name",
          discnumber: "1",
          title: "Track Title",
          totaldiscs: "1",
          tracknumber: "1",
        },
      }),
    ).toBe("Artist Name/Album Name/01 Track Title")
  })

  test("evaluates the default naming script for a multi-disc compilation", () => {
    expect(
      run({
        script: DEFAULT_NAMING_SCRIPT,
        variables: {
          _multiartist: "1",
          album: "Album Name",
          albumartist: "Various Artists",
          artist: "Track Artist",
          discnumber: "2",
          title: "Track Title",
          totaldiscs: "2",
          tracknumber: "5",
        },
      }),
    ).toBe(
      "Various Artists/Album Name/2-05 Track Artist - Track Title",
    )
  })
})
