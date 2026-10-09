-- 移除自测题：删除题库表与仅被它使用的科目枚举。用户与登录相关表不受影响。

-- DropTable
DROP TABLE IF EXISTS "Question";

-- DropEnum
DROP TYPE IF EXISTS "Subject";
