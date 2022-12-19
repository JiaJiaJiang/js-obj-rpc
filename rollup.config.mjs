import babel from "@rollup/plugin-babel";
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
const percentage=process.env.BROWSER_COVER||50;
export default {
	input: ["./index.js"],
	output: {
		file: `./dist/rpc.js`,
		format: "umd",
		name: "RPC",
		sourcemap: true,
	},
	plugins: [
		commonjs(),
		nodeResolve({
			browser:true,
		}),
		babel({
			sourceMaps: true,
			presets: [
				[
					"@babel/preset-env",
					{
						"targets":{
							"browsers":`cover ${percentage}%`
						},
						"modules": false,
						"useBuiltIns": "usage",
						"debug": false,
						"corejs":3
					}
				],
				["minify", {
					mangle:true,
				}],
			],
			plugins:[
				"babel-plugin-remove-comments",
			]
		}),
	],
}