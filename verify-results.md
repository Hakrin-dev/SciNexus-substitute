# Vercel 冒烟验证结果

- 时间(UTC): Tue Sep  1 09:08:43 UTC 2026

## 1. /api/health
```json
{"status":"healthy","service":"研枢 YanShu API","version":"1.0.0","timestamp":1788253723451,"stats":{"papers":4,"scholars":6,"institutions":8}}
```

## 2. /api/papers (前1条)
```json
{"data":[{"id":"ultralong-1m","date":"2026-07-25","venue":"ICML 2026 · Oral","venueTone":"violet","authors":"Wei-Lin Chiang · Zhuohan Li · et al. (UC Berkeley)","title":"UltraLong-1M: 一个面向百万级 Token 推理的自回归 Transformer 长程记忆机制","abstract":"UltraLong-1M 提出了一个分层的键值压缩与稀疏注意力机制,使 8B 参数的 Transformer 能在单张 H100 上稳定训练 1M Token 上下文。在 LongBench v2 与 RULER 上分别取得 78.3 与 91.4 分,相
```

## 3. 首页
```
HTTP 200, TTFB 0.118884s, 总耗时 0.119113s
```

## 4. 登录演示账号 (hankairun/yanshu123)
```json
{"data":{"token":"dXNlcl9kZW1vOjQ6MTc4ODg1ODUyMzkyOToyZDQyNjVhMGRiMzNjZTUwNmM2NzU0NGVkNjYyNWY2YmMxZmUwNTYxZDViNGJkMTM0MzA5ZmYyMzA0NzA1ZWRh","user":{"id":"user_demo","username":"hankairun","email":"hankairun@example.com","display_name":"韩凯润","avatar_color":"#5046E5"}},"success":true}

```

## 5. 带 token 访问 /api/auth/me
```json
{"data":{"id":"user_demo","username":"hankairun","email":"hankairun@example.com","display_name":"韩凯润","avatar_color":"#5046E5"},"success":true}
```
