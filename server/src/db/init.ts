import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/** 执行 schema.sql，创建数据库与表结构（幂等，可重复运行） */
async function main(): Promise<void> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log(`连接 ${process.env.DB_HOST}:${process.env.DB_PORT} 执行 schema.sql ...`);
  await connection.query(sql);
  console.log('数据库 sticker_note_sync 初始化完成。');

  await connection.end();
}

main().catch((err) => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
