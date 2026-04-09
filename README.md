# Synapse AI

AI-powered note summarization plugin for Obsidian.

## 功能

调用 DeepSeek API，根据当前笔记内容自动生成摘要，并写入笔记的 YAML frontmatter `summary` 字段。

## 开发

```bash
npm install
npm run dev      # watch 模式
npm run build    # 生产构建
```

## 项目结构

```
src/
  main.ts                     # 插件入口
  commands/
    generateSummary.ts        # 生成摘要命令
  services/
    aiService.ts              # AI API 封装
```

## 手动安装

将 `main.js`、`manifest.json` 复制到 `<Vault>/.obsidian/plugins/synapse-ai/`。
