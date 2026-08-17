"""PDF 安全下载与文本提取（移植自队友架构，含 SSRF 防护、%PDF 头校验、30MB 限制）。

download_pdf：从公开 URL 安全下载 PDF（拒绝 localhost/内网、账号密码、重定向过多）；
extract_pdf_chunks：pypdf 分页提取并切成带页码的 chunk。
"""
from __future__ import annotations

import io
import ipaddress
import re
import socket
import ssl
from html import unescape
from urllib.parse import urljoin, urlsplit

import certifi
import httpx
from pypdf import PdfReader

from research_assistant.tools.evidence.hybrid import PaperChunk

URL_PATTERN = re.compile(r"https?://[^\s<>\"]+")
MAX_PDF_BYTES = 30 * 1024 * 1024


def extract_url_and_question(user_input: str) -> tuple[str, str]:
    match = URL_PATTERN.search(user_input)
    if not match:
        raise ValueError("论文精读需要一个 http/https 论文链接。建议提供可直接打开的 PDF 链接。")
    url = match.group(0).rstrip("，。；;、)")
    question = (user_input[: match.start()] + user_input[match.end() :]).strip()
    question = question.strip("，。；;：: ")
    return url, question or "请总结论文的研究问题、方法、主要结果和局限。"


def _validate_public_url(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme not in {"http", "https"} or not parts.hostname:
        raise ValueError("只支持有效的 http/https 论文链接。")
    if parts.username or parts.password:
        raise ValueError("论文链接不允许包含用户名或密码。")
    if parts.hostname.lower() == "localhost":
        raise ValueError("不允许读取 localhost 链接。")
    try:
        address = ipaddress.ip_address(parts.hostname)
    except ValueError:
        try:
            resolved = {
                item[4][0]
                for item in socket.getaddrinfo(
                    parts.hostname,
                    parts.port or (443 if parts.scheme == "https" else 80),
                    type=socket.SOCK_STREAM,
                )
            }
        except (OSError, UnicodeError, ValueError) as exc:
            raise RuntimeError(f"无法解析论文链接域名：{parts.hostname}") from exc
        if not resolved:
            raise RuntimeError(f"论文链接域名没有可用地址：{parts.hostname}")
        addresses = [ipaddress.ip_address(value) for value in resolved]
    else:
        addresses = [address]
    if any(not address.is_global for address in addresses):
        raise ValueError("不允许读取本机或内网地址。")


def _arxiv_pdf_url(url: str) -> str:
    parts = urlsplit(url)
    if parts.hostname in {"arxiv.org", "www.arxiv.org"} and "/abs/" in parts.path:
        paper_id = parts.path.split("/abs/", 1)[1]
        return f"https://arxiv.org/pdf/{paper_id}.pdf"
    return url


def _discover_pdf_url(html_text: str, page_url: str) -> str | None:
    patterns = (
        r'<meta[^>]+name=["\']citation_pdf_url["\'][^>]+content=["\']([^"\']+)',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']citation_pdf_url["\']',
        r'href=["\']([^"\']+\.pdf(?:\?[^"\']*)?)["\']',
    )
    for pattern in patterns:
        match = re.search(pattern, html_text, flags=re.IGNORECASE)
        if match:
            return urljoin(page_url, unescape(match.group(1)))
    return None


def _request_once(url: str, headers: dict[str, str], timeout: float, connection_mode: str) -> httpx.Response:
    if connection_mode == "system":
        return httpx.get(url, headers=headers, timeout=timeout, follow_redirects=False)
    verify: bool | ssl.SSLContext = True
    if connection_mode == "tls12":
        context = ssl.create_default_context(cafile=certifi.where())
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.maximum_version = ssl.TLSVersion.TLSv1_2
        verify = context
    with httpx.Client(verify=verify, trust_env=False, timeout=timeout, follow_redirects=False,
                      headers={"Connection": "close"}) as client:
        return client.get(url, headers=headers)


def _request_with_fallback(url: str, headers: dict[str, str], timeout: float) -> httpx.Response:
    errors: list[str] = []
    last_error: Exception | None = None
    current_url = url
    for _ in range(6):
        _validate_public_url(current_url)
        response: httpx.Response | None = None
        for connection_mode in ("system", "direct", "tls12"):
            try:
                candidate = _request_once(current_url, headers, timeout, connection_mode)
                if 400 <= candidate.status_code < 600:  # httpx>=0.28 raise_for_status 对 3xx 也抛错，重定向单独处理
                    candidate.raise_for_status()
                response = candidate
                break
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                last_error = exc
                errors.append(f"{connection_mode}: {exc}")
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status not in {429, 500, 502, 503, 504}:
                    raise RuntimeError(f"论文链接请求失败：HTTP {status}") from exc
                last_error = exc
                errors.append(f"{connection_mode}: HTTP {status}")
        if response is None:
            break
        if response.is_redirect:
            location = response.headers.get("location")
            if not location:
                raise RuntimeError("论文链接重定向缺少目标地址。")
            current_url = urljoin(current_url, location)
            continue
        return response
    diagnostics = "；".join(errors)
    if response is not None and response.is_redirect:
        raise RuntimeError("论文链接重定向次数过多。")
    raise RuntimeError(f"无法下载论文（已尝试系统连接、直连和 TLS 1.2）：{diagnostics}。"
                       "请尝试复制浏览器中的直接 PDF 下载链接。") from last_error


def download_pdf(url: str, timeout: float = 12.0) -> tuple[bytes, str]:
    url = _arxiv_pdf_url(url)
    _validate_public_url(url)
    headers = {"Accept": "application/pdf,text/html;q=0.9,*/*;q=0.5", "User-Agent": "AcademicAgentsStarter/0.1"}
    response = _request_with_fallback(url, headers, timeout)
    content_type = response.headers.get("content-type", "").lower()
    content = response.content
    final_url = str(response.url)
    _validate_public_url(final_url)

    if "application/pdf" not in content_type and not content.startswith(b"%PDF"):
        pdf_url = _discover_pdf_url(response.text, final_url)
        if not pdf_url:
            raise RuntimeError("该链接打开的是论文网页，但页面没有提供可下载的 PDF。"
                               "请复制网页中的 PDF 下载链接后重试；付费或需要登录的正文无法自动读取。")
        _validate_public_url(pdf_url)
        response = _request_with_fallback(pdf_url, headers, timeout)
        content = response.content
        final_url = str(response.url)
        _validate_public_url(final_url)

    if not content.startswith(b"%PDF"):
        raise RuntimeError("下载内容不是有效 PDF，请提供可直接下载的 PDF 链接。")
    if len(content) > MAX_PDF_BYTES:
        raise RuntimeError("PDF 超过 30 MB，当前演示版本暂不处理。")
    return content, final_url


def extract_pdf_chunks(pdf_bytes: bytes, chunk_size: int = 1800) -> tuple[list[PaperChunk], int]:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception as exc:
            raise RuntimeError("PDF 已加密，无法读取正文。") from exc

    chunks: list[PaperChunk] = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = re.sub(r"\s+", " ", page.extract_text() or "").strip()
        if not text:
            continue
        start = 0
        part = 1
        while start < len(text):
            chunk_text = text[start : start + chunk_size]
            chunks.append(PaperChunk(page=page_number, chunk_id=f"p{page_number}-c{part}", text=chunk_text))
            if start + chunk_size >= len(text):
                break
            start += chunk_size - 200
            part += 1

    if not chunks:
        raise RuntimeError("PDF 没有可提取的文字，可能是扫描图片版；当前版本尚未接入 OCR。")
    return chunks, len(reader.pages)
