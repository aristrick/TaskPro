// Aturan kode TaskPro. Kesalahan (error) menggagalkan CI; peringatan (warning) dihitung dan dibatasi (lihat skrip "lint" di package.json),
// sehingga pemakaian `any` dan variabel tak terpakai tidak bisa bertambah, hanya boleh berkurang.
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'public/**', 'next-env.d.ts'] },
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': hooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-unused-expressions': 'off',   // pola `cond && aksi()` dipakai di banyak tempat
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
)
