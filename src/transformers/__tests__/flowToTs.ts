import {
  transformImports,
  transformFunctionTypes,
  transformIdentifiers,
  transformTypeAliases,
  transformInterfaces,
  transformTypeCastings
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
});
