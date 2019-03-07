import { transformImports } from "../maybeTypes";
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
