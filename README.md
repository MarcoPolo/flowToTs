# Intro

Converts flow files to ts using jscodeshift. It isn't perfect, but should get you pretty close. There are a couple of fundamental differences that have to be manually converted.

# Usage

```
$ npx flow-to-ts -o ts /path/to/flow/files # Will convert .js files into .ts files
```

If you're going to be using this tool a couple of times, it's probably best not to use `npx` since it will reinstall everything [everytime](https://github.com/zkat/npx/issues/113) you run it.

instead use `npm install -g flow-to-ts`

## Advanced Usage

### .js files with jsx

```
$ npx flow-to-ts -o tsx /path/to/flow/files # Will convert .js files into .tsx files
```

### .jsx files

```
$ npx flow-to-ts -o tsx /path/to/flow/files # Will convert .jsx files into .tsx files
```

### .js.flow files

```
$ npx flow-to-ts -o d.ts /path/to/flow/files # Will convert .js.flow files into .d.ts files
```

### Dry Mode and passing arguments to jscodeshift

Everything after -- will be forwarded to jscodeshift cli

```
$ npx flow-to-ts -o ts /path/to/flow/files -- --dry # Won't change code
```

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
