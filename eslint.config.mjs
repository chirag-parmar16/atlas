import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/ban-types': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off', // Added
            'no-empty': 'off',
            'no-var': 'off',
            'no-async-promise-executor': 'off',
            'no-undef': 'off',
            'prefer-const': 'off', // Added
            'prefer-rest-params': 'off', // Added
            'no-useless-assignment': 'off'
        }
    },
    {
        ignores: [
            "dist/",
            "node_modules/",
            "split.js",
            "migrate-ui.js",
            "vite.config.ts"
        ]
    }
);
