# Intro

Converts flow files to ts using jscodeshift. It isn't perfect, but should get you pretty close. There are a couple of fundamental differences that have to be manually converted.

## Fundamental Differences

### .js.flow vs .d.ts

In flow, definition files (.js.flow) are looked at with higher precedence over .js files. The reverse is true for typescript.

This is a problem if you do something like: "import {type Foo} from 'foo'" and there exists `foo.js` and `foo.js.flow`. You'll have to manually restructure your code.

### Automatic casting of strings to enums in certain cases.

In certain cases TS won't cast a string to an enum as readily in flow. This is easily seen in `Factory` functions like you would use for Immutable js' Records. Here's a small example that fails. The fix is pretty simple, just cast the argument before you pass it in.

```ts
type Bar = {
  foo: number;
  bar: "hi" | "bye";
  arr: Array<number>;
};

type Factory<T> = () => T;

const factoryFactory = <F>(f: F): Factory<F> => () => ({ ...f });

// This fails
const barFactory: Factory<Bar> = factoryFactory({
  foo: 3,
  bar: "bye",
  arr: [1323, 54]
});

// This works
const barFactory2: Factory<Bar> = factoryFactory({
  foo: 3,
  bar: "bye",
  arr: [1323, 54]
} as Bar);
```

# Usage

I recommend running these with a --dry flag first to see if your code will cause any errors during transformation.

`npm run transformFlowToTSX -- PATH`

(recommended) Will convert all .js files into .tsx files in a given `PATH`.

`npm run transformFlowToTS -- PATH`

Will convert all .js files into .ts files in a given `PATH`.

`npm run transformFlowDefToDTS -- PATH`

Will convert all .js.flow files into .d.ts files in a given `PATH`.
