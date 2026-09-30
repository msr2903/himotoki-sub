import {defineConfig,mergeConfig} from 'vitest/config';import base from '../vitest.config';import {resolve} from 'node:path';
export default mergeConfig(base,defineConfig({resolve:{alias:{react:resolve(__dirname,'deps/node_modules/react/index.js'),'react-test-renderer':resolve(__dirname,'deps/node_modules/react-test-renderer/index.js')}}}));
