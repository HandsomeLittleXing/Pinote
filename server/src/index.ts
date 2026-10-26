import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { devicesRouter } from './routes/devices';
import { pairingRouter } from './routes/pairing';
import { syncRouter } from './routes/sync';

dotenv.config();

// 兜底日志：避免单个请求的异常直接导致整个服务退出
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const app = express();
// 部署在 Nginx 等反向代理之后时开启，限流才能拿到真实客户端 IP；
// 直接暴露时保持关闭，避免客户端伪造 X-Forwarded-For 绕过限流。
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/devices', devicesRouter);
app.use('/pairing', pairingRouter);
app.use('/sync', syncRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`StickerNote sync server listening on :${port}`);
});
