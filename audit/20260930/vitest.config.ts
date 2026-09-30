import {defineConfig,mergeConfig} from 'vitest/config';import base from '../vitest.config';import {resolve} from 'node:path';
export default mergeConfig(base,defineConfig({resolve:{alias:{'virtual:reload-on-update-in-background-script':resolve(__dirname,'virtual-reload.ts')}}}));
