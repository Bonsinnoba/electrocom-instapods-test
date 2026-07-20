import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        include: [
            'lucide-react',
            'recharts',
            'react-router-dom',
            'leaflet',
            'react-leaflet',
            'react-quill',
            'papaparse',
            'lightweight-charts'
        ]
    },
    build: {
        target: 'es2019',
        cssCodeSplit: true,
        sourcemap: false,
        reportCompressedSize: true,
        chunkSizeWarningLimit: 900,
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug']
            }
        },
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;
                    if (id.includes('recharts')) return 'charts';
                    if (id.includes('react-router') || id.includes('@remix-run')) return 'router';
                    if (id.includes('lucide-react')) return 'icons';
                    if (id.includes('leaflet')) return 'maps';
                    if (id.includes('react-quill')) return 'editor';
                    if (id.includes('papaparse')) return 'csv';
                    if (id.includes('lightweight-charts')) return 'trading';
                    return 'vendor';
                },
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            },
            treeshake: {
                moduleSideEffects: false,
                propertyReadSideEffects: false,
                tryCatchDeoptimization: false
            }
        },
    },
})
