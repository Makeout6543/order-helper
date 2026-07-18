# 新 Supabase 项目初始化

1. 在新项目 SQL Editor 完整运行 `setup.sql`。
2. 在 Authentication 创建邮箱密码用户。
3. 查询 `auth.users` 核对用户 UUID，再按 `setup.sql` 末尾示例授予管理员。
4. 本地 `.env.production` 只填写新项目 URL 和 publishable key。
5. 登录应用，只导入 2026-06-20 最新备份；预期恢复结果为 2 个供应商、22 个物料、2 张订单。
6. 核对两张订单的原始时间、数据读写、重复提交保护和多端实时同步。

不要向前端写入数据库密码、secret key 或 service_role key。
