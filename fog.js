import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    publicDir: 'publiic',
    build: {
        target: 'esnext'
    },
    resolve: {
        alias: {
            'three/examples/jsm': path.resolve(__dirname, 'node_modules/three/examples/jsm'),
            'three/addons': path.resolve(__dirname, 'node_modules/three/examples/jsm')
        }
    }
});
