#!/usr/bin/env node
var argv = require("optimist").argv;

const usage = `
Convert your flow type file into ts.

flowToTs [options] <PATH>

Options:

--output, -o\tOutput file format [string] [choices: "ts", "tsx", "d.ts"] [default: "tsx"]

What should I output?

Output "ts" when you are converting a regular non jsx file.
Ouptut "tsx" when your file has jsx inside.
Ouptut "d.ts" when you want to convert a .js.flow file. (only reads in .js.flow files)

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
  `./node_modules/jscodeshift/bin/jscodeshift.js`,
  [
    `-t`,
    `src/transformers/flowToTs.ts`,
    `--transformFileIn=${fileIn}`,
    `--transformFileOut=${fileOut}`,
    ...extra
  ],
  { stdio: [process.stdin, process.stdout, process.stderr], cwd: process.cwd() }
];

let spawnedSubCmd;
if (output == "ts") {
  spawnedSubCmd = spawn(...subCmd(".js", ".ts", argv._));
} else if (output == "tsx") {
  spawnedSubCmd = spawn(...subCmd(".js", ".tsx", argv._));
} else if (output == "d.ts") {
  spawnedSubCmd = spawn(
    ...subCmd(".js", ".tsx", '--extensions="flow"', argv._)
  );
} else {
  console.log(usage);
  process.exit(0);
  return;
}

spawnedSubCmd.on("close", code => {
  process.exit(code);
});
