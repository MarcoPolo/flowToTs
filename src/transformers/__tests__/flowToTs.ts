import {
  transformImports,
  transformFunctionTypes,
  transformTypeAliases,
  transformInterfaces,
  transformTypeCastings,
  transformExports,
  transformIdentifiers,
  transfromTypeAnnotations,
  transformDeclaration,
  transformTypeParamInstantiation,
  allTransformations,
  transformNullCoalescing,
  transformTypeParameters
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
  it("Transforms extends in generics", () => {
    const input = "type First<T: {}> = (a: Array<T>) => T";
    const out = "type First<T extends {}> = (a: Array<T>) => T;";
    const collection = j(input);

    transformFunctionTypes(collection, j);
    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms function types", () => {
    const input = "type F = (A, B) => C";
    const out = "type F = (a: A, b: B) => C;";
    const collection = j(input);

    transformFunctionTypes(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms function generics", () => {
    const input = "function foo<T: B & {}>() {}";
    const out = "function foo<T extends B & {}>() {}";
    const collection = j(input);

    transformFunctionTypes(collection, j);
    transformTypeParameters(collection, j);
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

  it("Transforms maybe types", () => {
    const input = "type F = (coolArg: A, optional?: B) => ?C";
    const out = "type F = (coolArg: A, optional?: B) => C | null;";
    const collection = j(input);

    transformFunctionTypes(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms nested maybe types", () => {
    const input = "const c = (foo: number): ?Foo<n> => 'asdf'";
    const out = "const c = (foo: number): Foo<n> | null => 'asdf'";
    const collection = j(input);

    transfromTypeAnnotations(collection, j);
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
    const input = "type A<K> = {[key: Foo]: number}";
    const out = "type A<K> = {\n  [K in Foo]: number;\n};";
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

  it("Transforms function with rest types", () => {
    const input = "type A = ((...Array<any>) => Object) => string";
    const out = "type A = (arg0: (...args: Array<any>) => Object) => string;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms unnamed types", () => {
    const input = "type A = (string, string, string) => string";
    const out =
      "type A = (arg0: string, arg1: string, arg2: string) => string;";
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
  it("Transforms indexing", () => {
    const input = "type F = {[key: ServiceIdWithContact]: string}";
    const out = "type F = {\n  [K in ServiceIdWithContact]: string;\n};";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle $Exact", () => {
    const input = "type B = $Exact<A>";
    const out = "type B = A;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms React.Node", () => {
    const input = "type B = React.Node<Props>";
    const out = "type B = React.ReactNode<Props>;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms React.Node", () => {
    const input = "type B = React.ElementRef<T>";
    const out = "type B = React.Ref<T>;";
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

  it("Can handle $ReadOnlyArray", () => {
    const input = "type B = $ReadOnlyArray<A>";
    const out = "type B = ReadonlyArray<A>;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms TimeoutID", () => {
    const input = "type B = TimeoutID";
    const out = "type B = number;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms IntervalID", () => {
    const input = "type B = IntervalID";
    const out = "type B = number;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle $Diff", () => {
    const input = "type B = $Diff<A, C>";
    const out = "type B = Exclude<A, C>;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle SyntheticEvent", () => {
    const input = "type B = SyntheticEvent";
    const out = "type B = React.SyntheticEvent;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle SyntheticMouseEvent", () => {
    const input = "type B = SyntheticMouseEvent";
    const out = "type B = React.MouseEvent;";
    const collection = j(input);

    transformTypeAliases(collection, j);
    expect(collection.toSource()).toEqual(out);
  });

  it("Can handle SyntheticKeyboardEvent", () => {
    const input = "type B = SyntheticKeyboardEvent";
    const out = "type B = React.KeyboardEvent;";
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

  it("Transforms exports using Qualified identifiers", () => {
    const input =
      "export type SearchKey = I.List<number | Array<number> | Foo.Bar.Baz<number>>";
    const out =
      "export type SearchKey = I.List<number | Array<number> | Foo.Bar.Baz<number>>;";
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

  it("Preserves comments in Obj types", () => {
    const input = `type Foo = {
// THis is an important comment
bar: number,
baz: string, // another important comment
}`;
    const out = `type Foo = {
  // THis is an important comment
  bar: number,
  baz: string // another important comment
};`;
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

describe("Declarations", () => {
  it("Transforms export declarations", () => {
    const input = "declare export var mobileStyles: {}";
    const out = "export declare const mobileStyles: {};";
    const collection = j(input);
    [transformDeclaration].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms export function declarations", () => {
    const input =
      "declare export function styled<T>(Component: T): (...styles: Array<any>) => T";
    const out =
      "export declare function styled<T>(Component: T): (...styles: Array<any>) => T;";
    const collection = j(input);
    [transformDeclaration].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms export class declarations", () => {
    const input = "declare class Text extends React.Component<Props> {}";
    const out = "declare class Text extends React.Component<Props> {}";
    const collection = j(input);
    allTransformations.forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms export default class declarations", () => {
    const input = "declare export default class Foo {}";
    const out = "declare class Foo {}\nexport default Foo;";
    const collection = j(input);
    allTransformations.forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("transforms complex class declarations", () => {
    const input =
      "declare export class Box<A> extends React.Component<Props> {}";
    const out = "export declare class Box<A> extends React.Component<Props> {}";
    const collection = j(input);
    allTransformations.forEach(t => t(collection, j));
    expect(collection.toSource()).toEqual(out);
  });

  it("transforms complex class defs", () => {
    const input = "class Box<A> extends React.Component<Props> {}";
    const out = "class Box<A> extends React.Component<Props> {}";
    const collection = j(input);
    allTransformations.forEach(t => t(collection, j));
    expect(collection.toSource()).toEqual(out);
  });
});

describe("Classes", () => {
  it("Transforms classes", () => {
    const input =
      "class OverlayParent extends React.Component<$Diff<T, Props>, State> {}";
    const out =
      "class OverlayParent extends React.Component<Exclude<T, Props>, State> {}";
    const collection = j(input);
    [transformTypeParamInstantiation].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });
});

describe("Transform ?? and ?.", () => {
  const commentLine = "// Auto generated from flowToTs. Please clean me!\n";
  it("Transforms ?? - since it's not valid TS yet", () => {
    const input = "foo ?? bar";
    const out = commentLine + "foo !== null && foo !== undefined ? foo : bar";
    const collection = j(input);
    [transformNullCoalescing].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms ?. since it's not valid TS yet", () => {
    const input = "foo?.bar";
    const out =
      commentLine + "foo === null || foo === undefined ? undefined : foo.bar";
    const collection = j(input);
    [transformNullCoalescing].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms complex cases of ??", () => {
    const input = "foo ?? bar ?? baz";
    const out =
      commentLine +
      "(foo !== null && foo !== undefined ? foo : bar) !== null && (foo !== null && foo !== undefined ? foo : bar) !== undefined ? foo !== null && foo !== undefined ? foo : bar : baz";
    const collection = j(input);
    [transformNullCoalescing].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });

  it("Transforms ?. nested", () => {
    const input = "foo?.bar?.bam";
    const out =
      commentLine +
      "(foo === null || foo === undefined ? undefined : foo.bar) === null || (foo === null || foo === undefined ? undefined : foo.bar) === undefined ? undefined : (foo === null || foo === undefined ? undefined : foo.bar).bam";
    const collection = j(input);
    [transformNullCoalescing].forEach(t => t(collection, j));

    expect(collection.toSource()).toEqual(out);
  });
});

// TODO Add class with typed methods inside
