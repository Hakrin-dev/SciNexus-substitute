# Vercel 邮箱认证冒烟验证结果

- 时间(UTC): Tue Sep 15 15:03:20 UTC 2026

## 1. 注册发送 OTP(真实 DirectMail 投递,收件=发信域名自身)
```json
{"data":{"challengeId":"9aae818e0fd94bbe3d22218c23923d1a"},"success":true}
```

## 2. verify-otp 错误验证码(应返回 4xx 错误而非 5xx/配置错误)
```
HTTP 422
```

## 3. 密码重置请求(真实发送重置邮件)
```json
{"data":{"success":true},"success":true}
```

## 4. 演示账号密码登录(cookie 会话)
```
{"data":{"user":{"id":"user_demo","username":"hankairun","email":"hankairun@example.com","display_name":"韩凯润","avatar_color":"#5046E5"}},"success":true}
Set-Cookie 头: 1 条 cookie 写入
```

## 5. 带 cookie 访问 /api/auth/me
```json
{"data":{"id":"user_demo","username":"hankairun","email":"hankairun@example.com","display_name":"韩凯润","avatar_color":"#5046E5"},"success":true}
```

## 6. /api/knowledge/health (回归:知识底座不受影响)
```json
{"success":true,"data":{"status":"ready","provider":"remote","source":"remote_knowledge_base","checkedAt":"2026-09-15T15:03:25.307Z","tookMs":1900,"runtime":{"circuit":"closed","retryAt":null,"retryAf
```

## 7. 首页
```
HTTP 200, 总耗时 0.170895s
```
