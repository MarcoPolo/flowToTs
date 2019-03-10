# Intro

Converts flow files to ts using jscodeshift

# Usage

I recommend running these with a --dry flag first to see if your code will cause any errors during transformation.

`npm run transformFlowToTSX -- PATH`

(recommended) Will convert all .js files into .tsx files in a given `PATH`.

`npm run transformFlowToTS -- PATH`

Will convert all .js files into .ts files in a given `PATH`.

`npm run transformFlowDefToDTS -- PATH`

Will convert all .js.flow files into .d.ts files in a given `PATH`.

If you want to run with try mode you
