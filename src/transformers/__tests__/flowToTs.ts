import {
  transformImports,
  transformFunctionTypes,
  transformTypeAliases,
  transformInterfaces,
  transformTypeCastings,
  transformExports,
  transformIdentifiers
} from "../flowToTs";
import * as JSCodeShift from "JSCodeShift";
jest.autoMockOff();

const j = JSCodeShift.withParser("flow");

describe("Transform Import statements", () => {
  it("Transforms import type proper", () => {
    const input = "import type {Foo} from './foo'";
    const out = "import { Foo } from './foo';";
    const collection = j(input);

    transformImports(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms import type proper", () => {
    const input = "import {type Foo} from './foo'";
    const out = "import { Foo } from './foo';";
    const collection = j(input);

    transformImports(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms import type properly amidst a lot of stuff", () => {
    const input = "import {type Foo} from './foo'";
    const out = "import { Foo } from './foo';";
    const collection = j(input);

    transformImports(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Functions", () => {
  it("Transforms function types", () => {
    const input = "type F = (A, B) => C";
    const out = "type F = (a: A, b: B) => C;";
    const collection = j(input);

    transformFunctionTypes(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Preserves arg names", () => {
    const input = "type F = (coolArg: A, B) => C";
    const out = "type F = (coolArg: A, b: B) => C;";
    const collection = j(input);

    transformFunctionTypes(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Preserves optional args", () => {
    const input = "type F = (coolArg: A, optional?: B) => C";
    const out = "type F = (coolArg: A, optional?: B) => C;";
    const collection = j(input);

    transformFunctionTypes(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Works with generics", () => {
    const input = "type F = (A<number>, B) => C";
    const out = "type F = (a: A<number>, b: B) => C;";
    const collection = j(input);

    transformFunctionTypes(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Exact types", () => {
  it("Transforms exact types", () => {
    const input = "type A = {| foo: number |}";
    const out = "type A = {\n  foo: number\n};";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms exact types with type params", () => {
    const input = "type A<B> = {| foo: number, bar: B |}";
    const out = "type A<B> = {\n  foo: number,\n  bar: B\n};";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms exact types with type params and constraints", () => {
    const input = "type A<B: number> = {| foo: number, bar: B |}";
    const out = "type A<B extends number> = {\n  foo: number,\n  bar: B\n};";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms mixed", () => {
    const input = "type A = {foo: mixed}";
    const out = "type A = {\n  foo: unknown\n};";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Handles spreads", () => {
    const input = "type A = {...B, c: number}";
    const out = "type A = {\n  c: number\n} & B;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms Indexer", () => {
    const input = "type A<K> = {[K]: number}";
    const out = "type A<K> = {\n  [k: K]: number\n};";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms function types", () => {
    const input = "type A = () => string";
    const out = "type A = () => string;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Handles opaque types", () => {
  it("Handles simple opaque", () => {
    const input = "opaque type A = string";
    const out = "type A = string;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Handles interface definition and readonly", () => {
  it("Handles interface with variance", () => {
    const input = "interface A { +b: B, -c: C }";
    const out = "interface A {\n  readonly b: B;\n  c: C;\n}";
    const collection = j(input);

    transformInterfaces(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Transforms castings", () => {
  it("Can handle a simple casting", () => {
    const input = "1 + (a: number)";
    const out = "1 + (a as number)";
    const collection = j(input);

    transformTypeCastings(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Can handle common special Flow Types", () => {
  it("Can handle $Exact", () => {
    const input = "type B = $Exact<A>";
    const out = "type B = A;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle $Keys", () => {
    const input = "type B = $Keys<A>";
    const out = "type B = keyof A;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle $Values", () => {
    const input = "type B = $Values<A>";
    const out = "type B = A[keyof A];";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle $Call", () => {
    const input = "type B = $Call<A>";
    const out = "type B = ReturnType<A>;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle $ElementType", () => {
    const input = "type B = $ElementType<T, k>";
    const out = "type B = T[k];";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle $PropertyType", () => {
    const input = "type B = $PropertyType<T, 'foo'>";
    const out = 'type B = T["foo"];';
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle $Diff", () => {
    const input = "type B = $Diff<A, B>";
    const out = "type B = Exclude<A, B>;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle any", () => {
    const input = "type B = any;";
    const out = "type B = any;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Export type works", () => {
  it("Transforms export types properly", () => {
    const input = "export type F = {|foo: boolean|}";
    const out = "export type F = {\n  foo: boolean\n};";
    const collection = j(input);

    transformTypeAliases(collection, j);
    transformExports(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Qualified Types", () => {
  it("Transforms qualified types properly", () => {
    const input =
      "type Foo = {messages: Array<RPCTypesGregor.OutOfBandMessage>}";
    const out =
      "type Foo = {\n  messages: Array<RPCTypesGregor.OutOfBandMessage>\n};";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Union Types and Intersection", () => {
  it("Transforms Union Types", () => {
    const input = "type Foo = A | B";
    const out = "type Foo = A | B;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms Intersection Types", () => {
    const input = "type Foo = A & B";
    const out = "type Foo = A & B;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Transforms types", () => {
  it("Doesn't choke on types it's already visited", () => {
    const input = "export type Foo = boolean";
    const out = "export type Foo = boolean;";
    const collection = j(input);
    [
      transformFunctionTypes,
      transformIdentifiers,
      transformImports,
      transformInterfaces,
      transformTypeCastings,
      transformTypeAliases,
      transformExports
    ].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms tuples", () => {
    const input = "export type Foo = [boolean, A]";
    const out = "export type Foo = [boolean, A];";
    const collection = j(input);
    [transformExports, transformTypeAliases].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms Array types", () => {
    const input = "export type Foo = boolean[]";
    const out = "export type Foo = boolean[];";
    const collection = j(input);
    [transformExports, transformTypeAliases].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms Existential", () => {
    const input = "export type Foo = Bar<*>;";
    const out = "export type Foo = Bar<unknown>;";
    const collection = j(input);
    [transformExports, transformTypeAliases].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms Readonly", () => {
    const input = "type Foo = $ReadOnly<{foo: number, bar: string};";
    const out =
      "type Foo = {\n  readonly foo: number,\n  readonly bar: string\n};";
    const collection = j(input);
    [transformTypeAliases].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms empty", () => {
    const input = "type Foo = {foo?: empty, bar: number};";
    const out = "type Foo = { foo?: never, bar: number};";
    const collection = j(input);
    [transformTypeAliases].forEach(t => t(collection, j));

    expect(
      collection
        .toSource()
        .replace(/\n/g, "")
        .replace(/\ +/g, " ")
    ).toEqual(out);
  });
});

describe("JSX", () => {
  it("Works with JSX", () => {
    const input = "const A = (props: {foo: number}) => <p>hi {props.foo}</p>";
    const out =
      "const A = (props: {\n  foo: number\n}) => <p>hi {props.foo}</p>";
    const collection = j(input);
    [transformIdentifiers].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Works with Composite Components", () => {
    const input = "const A = (props: {foo: number}) => <B foo={props.foo} />";
    const out =
      "const A = (props: {\n  foo: number\n}) => <B foo={props.foo} />";
    const collection = j(input);
    [transformIdentifiers].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });
});
