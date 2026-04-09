# Synapse AI — Agent 指南

## 项目概述

- **插件名**: Synapse AI
- **插件 ID**: `synapse-ai`
- **功能**: AI 驱动的笔记摘要生成（DeepSeek API）
- **技术栈**: TypeScript + esbuild → Obsidian 插件

## 项目结构

```
src/
  main.ts                     # 插件入口，只做命令注册
  commands/
    generateSummary.ts        # 摘要命令实现
  services/
    aiService.ts              # AI API 调用封装
```

## 命名规范

- **manifest.json**: `id` = `synapse-ai`, `name` = `Synapse AI`
- **package.json**: `name` = `synapse-ai`
- 所有 Notice 消息以 `Synapse AI` 开头

## 扩展方式

- 新增命令：在 `src/commands/` 下新建文件，然后在 `main.ts` 中 `import` 并注册
- 换模型：只改 `src/services/aiService.ts` 的 URL、headers 和 body

## 命令命名

- 命令 ID 使用通用名称（如 `generate-summary`），不绑定具体模型
- 命令 `name` 直接用中文（如"生成笔记摘要"），Obsidian 会自动以插件名分组

## 注意事项

- 使用 Obsidian 的 `requestUrl` 而非原生 `fetch`，避免跨域问题
- 写入 frontmatter 必须使用 `processFrontMatter` 安全 API
- 保持 main.ts 极简，所有业务逻辑放在 commands/ 和 services/ 下
