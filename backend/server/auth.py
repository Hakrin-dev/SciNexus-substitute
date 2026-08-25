"""简单会话认证模块(内存存储,演示用)——对齐前端 lib/server/auth.ts 的契约。

- token:HMAC-SHA256 签名的 base64url 串,格式 userId:tokenVersion:expireTs:sig
- 密码:PBKDF2-SHA256 加盐哈希(标准库,无额外依赖)
- 用户存储:进程内内存表;重启即清空(与现有 mock 数据层一致)

响应契约(前端 stores/auth.ts 依赖):
  成功:{"success": true, "data": {"token": str, "user": {...}}}
  失败:{"success": false, "error": str}(HTTP 401/400)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import random
import time
from typing import Optional

# token 有效期 7 天
TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

# 密钥:优先环境变量;未配置时回退开发密钥(与前端 lib/server/auth.ts 行为一致)
SECRET = os.environ.get("AUTH_SECRET", "yanshu-dev-secret-change-me")

_AVATAR_COLORS = ["#5046E5", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#06B6D4"]

# 内存用户表:user_id -> {id, username, email, display_name, avatar_color, password_hash, token_version}
_USERS: dict[str, dict] = {}
# username(或 email) -> user_id,用于登录查找
_LOOKUP: dict[str, str] = {}


def _gen_id(prefix: str = "u_") -> str:
    return prefix + hashlib.sha256(os.urandom(16)).hexdigest()[:12]


def _hash_password(password: str, salt: Optional[str] = None) -> str:
    """PBKDF2-SHA256 加盐哈希,格式 pbkdf2$iterations$salt$digest。"""
    salt = salt or os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"pbkdf2$100000${salt}${digest}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt, digest = stored.split("$")
        if algo != "pbkdf2":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iters)
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, TypeError):
        return False


def _sign(user_id: str, version: int, expire_ts: int) -> str:
    payload = f"{user_id}:{version}:{expire_ts}"
    sig = hmac.new(SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    raw = f"{payload}:{sig}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def _verify(token: str) -> Optional[str]:
    """校验 token,返回 user_id;无效返回 None。"""
    try:
        decoded = base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8")
        user_id, version_str, expire_str, sig = decoded.split(":")
        version = int(version_str)
        expire_ts = int(expire_str)
        if not user_id or time.time() > expire_ts:
            return None
        expected = hmac.new(
            SECRET.encode("utf-8"), f"{user_id}:{version}:{expire_ts}".encode("utf-8"), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        user = _USERS.get(user_id)
        if not user or (user.get("token_version") or 0) != version:
            return None
        return user_id
    except (ValueError, TypeError, Exception):
        return None


def _to_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row.get("email"),
        "display_name": row.get("display_name"),
        "avatar_color": row.get("avatar_color"),
    }


def _issue_token(user: dict) -> dict:
    version = user.get("token_version") or 0
    expire_ts = int(time.time()) + TOKEN_TTL_SECONDS
    token = _sign(user["id"], version, expire_ts)
    return {"token": token, "user": _to_user(user)}


def get_current_user_id(token: Optional[str]) -> Optional[str]:
    """从 Authorization Bearer token 解析当前用户 id;无效返回 None。"""
    if not token:
        return None
    return _verify(token)


def login(username: str, password: str) -> Optional[dict]:
    """登录:成功返回 {token, user},失败返回 None。"""
    key = (username or "").strip().lower()
    user_id = _LOOKUP.get(key)
    if not user_id:
        return None
    user = _USERS.get(user_id)
    if not user or not _verify_password(password, user["password_hash"]):
        return None
    return _issue_token(user)


def register(params: dict) -> dict:
    """注册:成功返回 {token, user};失败返回 {"error": str}。"""
    username = (params.get("username") or "").strip()
    password = params.get("password") or ""
    email = (params.get("email") or "").strip() or None
    display_name = (params.get("displayName") or "").strip() or username

    if len(username) < 2:
        return {"error": "用户名至少 2 个字符"}
    if len(password) < 6:
        return {"error": "密码至少 6 位"}
    if email and "@" not in email:
        return {"error": "邮箱格式不正确"}

    uname_key = username.lower()
    if uname_key in _LOOKUP:
        return {"error": "用户名已存在"}
    if email:
        email_key = email.lower()
        if email_key in _LOOKUP:
            return {"error": "邮箱已被注册"}

    user_id = _gen_id()
    color = random.choice(_AVATAR_COLORS)
    user = {
        "id": user_id,
        "username": username,
        "email": email,
        "display_name": display_name,
        "avatar_color": color,
        "password_hash": _hash_password(password),
        "token_version": 0,
    }
    _USERS[user_id] = user
    _LOOKUP[uname_key] = user_id
    if email:
        _LOOKUP[email.lower()] = user_id
    return _issue_token(user)


def get_user(user_id: str) -> Optional[dict]:
    """按 id 返回用户公开信息。"""
    user = _USERS.get(user_id)
    return _to_user(user) if user else None


def seed_demo_user() -> None:
    """预置演示账号 demo / demo123456,方便前端联调。"""
    if "demo" in _LOOKUP:
        return
    register({"username": "demo", "password": "demo123456", "displayName": "演示用户"})
