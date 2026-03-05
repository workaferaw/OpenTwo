import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

function electronResolvePlugin(): Plugin {
  const shimCode = `
// Patch: ensure require('electron') returns the internal API, not the npm stub
;(function() {
  const _Module = require('module');
  const _origLoad = _Module._load;
  _Module._load = function(request, parent, isMain) {
    if (request === 'electron') {
      try {
        const result = _origLoad.call(this, request, parent, isMain);
        if (typeof result === 'string' || (typeof result === 'object' && result && !result.app)) {
          // Got the npm stub — force internal resolution by using electron's own require
          const electronInternal = process.electronBinding ? require('electron') : result;
          if (typeof electronInternal !== 'string' && electronInternal.app) return electronInternal;
        }
        return result;
      } catch(e) {
        return _origLoad.call(this, request, parent, isMain);
      }
    }
    return _origLoad.call(this, request, parent, isMain);
  };
})();
`

  return {
    name: 'electron-resolve-fix',
    generateBundle(_, bundle) {
      for (const [filename, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && filename.endsWith('.js')) {
          chunk.code = shimCode + chunk.code
        }
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), electronResolvePlugin()],
    build: {
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), electronResolvePlugin()],
    build: {
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    css: {
      postcss: resolve(__dirname, 'postcss.config.js')
    }
  }
})
