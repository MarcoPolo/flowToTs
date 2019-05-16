#!/usr/bin/env node
var argv = require("optimist").argv;

const usage = `
Convert your flow type file into ts.

flowToTs [options] <PATH>

Options:

--output, -o\tOutput file format [string] [choices: "ts", "tsx", "d.ts", "tsxFromJsx"]

What should I pick for output?

Pick "ts" when you are converting a regular non jsx file.
Pick "tsx" when your file has jsx inside and is a .js file.
Pick "d.ts" when you want to convert a .js.flow file. (only reads in .js.flow files)
Pick "tsxFromJsx" when you want to transform a .jsx file

Use -- after the arguments to pass any extra arguments to jscodeshift.
Example:

flow-to-ts -o ts /path/to/flow/files -- --dry

check the README.md for more info: https://github.com/MarcoPolo/flowToTs
`;

if (argv.help || argv.h) {
  console.log(usage);
  process.exit(0);
  return;
}

const { spawn } = require("child_process");

const output = argv.output || argv.o;
const subCmd = (fileIn, fileOut, extra) => [
  require.resolve(`./node_modules/jscodeshift/bin/jscodeshift.js`),
  [
    `-t`,
    require.resolve(`./src/transformers/flowToTs.ts`),
    `--transformFileIn=${fileIn}`,
    `--transformFileOut=${fileOut}`,
    ...extra
  ],
  { stdio: [process.stdin, process.stdout, process.stderr], cwd: process.cwd() }
];

let spawnedSubCmd;
if (output == "ts") {
  spawnedSubCmd = spawn(...subCmd(".js$", ".ts", argv._));
} else if (output == "tsx") {
  spawnedSubCmd = spawn(...subCmd(".js$", ".tsx", argv._));
} else if (output == "tsxFromJsx") {
  argv._ = ["--extensions=jsx", ...argv._];
  spawnedSubCmd = spawn(...subCmd(".jsx", ".tsx", argv._));
} else if (output == "d.ts") {
  argv._ = ["--extensions=flow", ...argv._];
  spawnedSubCmd = spawn(...subCmd(".js.flow", ".d.ts", argv._));
} else {
  console.log(usage);
  process.exit(0);
  return;
}

spawnedSubCmd.on("close", code => {
  process.exit(code);
});
