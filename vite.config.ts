import { defineConfig } from 'vite-plus'

export default defineConfig({
    staged: {
        '*': 'vp check --fix',
    },
    fmt: {
        semi: false,
        singleQuote: true,
        vueIndentScriptAndStyle: true,
        tabWidth: 4,
    },
    lint: { options: { typeAware: true, typeCheck: true } },
})
