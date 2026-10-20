import { defineConfig } from 'vite';

// Relative base so the build works from IPFS gateways and any subpath.
export default defineConfig({
  base: './',
});
