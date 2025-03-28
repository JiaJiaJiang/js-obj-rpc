// eslint.config.cjs
// 此文件由deepseek生成
const eslint = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');
const nodePlugin = require('eslint-plugin-node');
const globals = require('globals');

module.exports = [
	{
		ignores: [
			"**/trash/**",
			"**/dist/**"
		]
	},
	eslint.configs.recommended,
	{
		languageOptions: {
			globals: Object.assign(
				{},
				globals.node,
				globals.browser,
			),
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module'
			}
		},
		plugins: {
			node: nodePlugin,
			import: importPlugin,
		},
		rules: {
			'no-return-await': 'error',
			'consistent-return': 'error',
			'indent': 'off',
			'no-console': 'off',
			'no-unused-vars': 'off',

			'prefer-const': 'error',
			'prefer-arrow-callback': 'error',
			'no-async-promise-executor': 'off',
			'arrow-body-style': 'off',

			"node/no-unsupported-features/es-syntax": "off",

			'import/order': 'off',
			'import/no-unresolved': 'error',
			'import/no-extraneous-dependencies': 'off',
		},
		settings: {
			'import/resolver': {
				node: {
					extensions: ['.js', '.jsx', '.ts', '.tsx', '.vue'],
					moduleDirectory: ['node_modules', 'src'],
				}
			}
		},
	},

];