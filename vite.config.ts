import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: 'src/electron',
    base: './',
    build: {
        outDir: '../../dist/electron',
        emptyOutDir: false,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/electron/index.html')
            }
        }
    }
});
