# Intro

Converts flow files to ts using jscodeshift

# Usage

`npx jscodeshift -t src/transformers/flowToTs.ts PATH`
where PATH is where your flow files are.

This does not rename files to .ts, use the unix `rename` tool (e.g. `rename -x -a ".ts" PATH`) for that. jscodeshift doesn't support renaming files, so this doesn't implement it.
