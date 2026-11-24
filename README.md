# 产品迭代防漂移项目模板

这个目录是一套可复制到任意产品项目的文档和规则模板。全局协议安装在 `~/.codex/AGENTS.md` 后，Codex 会在符合触发条件的开发任务中自动读取项目文档并执行分级、基线保护、三次尝试、Design QA 和回归流程。

## 一键初始化

```sh
~/.codex/bin/init-product-project.sh /绝对路径/你的项目
```

不传路径时使用当前目录：

```sh
~/.codex/bin/init-product-project.sh
```

脚本默认只创建缺失文件，不覆盖已有文件。需要覆盖模板文件时显式使用 `--force`；已有项目需要把协议入口追加到现有 `AGENTS.md` 时使用 `--merge-agents`。

## 初始化后顺序

1. 填写 `PRODUCT_SPEC.md`。
2. 填写 `docs/product/CURRENT_STATE.md`，只写当前最终状态。
3. 只有用户明确认可后，填写 `docs/product/APPROVED_BASELINE.md`。
4. 每轮反馈使用 `tasks/TASK_TEMPLATE.md`，并追加 `docs/product/ITERATION_LOG.md`。
5. 将验证结果同步到 `PROGRESS.md`。

