# 旧后端归档说明

`backend/`、根目录 `server.js` 和 `data/orders.json` 是迁移到 Supabase 前的旧实现。

- 当前 React 应用不再调用这些服务。
- 它们不属于当前生产部署，不应启动或发布。
- `backend/` 默认端口曾为 3002；`server.js` 曾使用另一套本地服务。
- 旧代码中可能存在历史凭证和业务数据；完成凭证轮换与数据确认前暂不删除。

新架构以 `src/lib/supabase.ts`、`src/stores/api.ts` 和 `supabase/setup.sql` 为准。
