import { InternalParserError, ParseError } from "./parse-error";
import { Combinator, ParseFn, SureCombinator } from "./types";
import { Backtrack } from "./utils";

export class Parser {
  #cursorPosition: number = 0;
  target: string | undefined = undefined;

  get cursorPosition() {
    return this.#cursorPosition;
  }

  #consume = ((v: string, b: Backtrack = Backtrack.Never) => {
    if (this.target == undefined)
      throw new InternalParserError("Attempting to parse non-existent string");

    if (b == Backtrack.IfEncountered && v.length !== 1)
      throw new InternalParserError(
        "Can only use string with length 1 with IfEncountered backtracking"
      );

    const start = this.cursorPosition;

    if (b == Backtrack.IfEncountered) {
      while (true) {
        const current = this.target[this.cursorPosition];

        if (current == v)
          return this.target.substring(start, this.cursorPosition);
        else if (current == undefined)
          throw new ParseError(
            this.cursorPosition,
            `IfEncountered couldn't reach the desired symbol '${v}'!`,
            "\0"
          );

        this.#cursorPosition++;
      }
    } else {
      for (const char of v)
        if (this.target[this.cursorPosition] !== char) {
          // cursor position on target is not the same as require char
          const err = new ParseError(
            this.cursorPosition,
            char,
            this.target[this.cursorPosition]
          );

          if (b == Backtrack.Never) throw err;
          else return err;
        } else this.#cursorPosition++;
    }

    return v;
  }) as ParseFn;

  static combinator =
    <T>(c: Combinator<T>): SureCombinator<T> =>
    (parse) =>
      c(parse) as T;

  parse<T>(v: string, c: Combinator<T>) {
    this.target = `${v}\x00`;
    this.#cursorPosition = 0;

    try {
      return c({
        consume: this.#consume,
        getCursorPosition: () => this.#cursorPosition,
        setCursorPosition: (pos: number) => (this.#cursorPosition = pos),
        error: ({ expected, found }) =>
          new ParseError(this.#cursorPosition, expected, found),
      });
    } catch (e) {
      if (e instanceof ParseError) return e;
      else throw e;
    }
  }
}
