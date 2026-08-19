/**
 * vitest 配置：node 环境运行 src/main 下的单元测试（纯逻辑与本地 IO，无需 Electron）。
 * 测试文件约定：src/**\/*.test.ts，随 main 进程模块放置。
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 15000
  }
})
