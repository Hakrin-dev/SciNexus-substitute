"""FastAPI 私有资源的认证与用户隔离回归测试。"""
from __future__ import annotations

import uuid
import unittest

import httpx

from server.main import app


class PrivateIsolationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        )
        suffix = uuid.uuid4().hex[:8]
        self.owner_headers = await self._register(f"owner-{suffix}")
        self.other_headers = await self._register(f"other-{suffix}")

    async def asyncTearDown(self) -> None:
        await self.client.aclose()

    async def _register(self, username: str) -> dict[str, str]:
        response = await self.client.post(
            "/api/auth/register",
            json={"username": username, "password": "password123"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        token = response.json()["data"]["token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_private_resources_require_authentication(self) -> None:
        for path in (
            "/api/library",
            "/api/library/folders",
            "/api/conversations",
            "/api/knowledge/graph",
            "/api/graph/private",
            "/api/projects",
            "/api/notifications",
            "/api/favorites",
            "/api/stats/detailed",
        ):
            with self.subTest(path=path):
                self.assertEqual((await self.client.get(path)).status_code, 401)

    async def test_users_cannot_read_or_delete_each_others_private_resources(self) -> None:
        project_response = await self.client.post(
            "/api/projects",
            headers=self.owner_headers,
            json={"name": "Owner project"},
        )
        self.assertEqual(project_response.status_code, 200, project_response.text)
        project_id = project_response.json()["data"]["id"]

        self.assertEqual(
            (await self.client.get(f"/api/projects/{project_id}", headers=self.other_headers)).status_code,
            404,
        )
        self.assertEqual(
            (await self.client.delete(f"/api/projects/{project_id}", headers=self.other_headers)).status_code,
            404,
        )
        self.assertEqual(
            (await self.client.get(f"/api/projects/{project_id}/outline", headers=self.other_headers)).status_code,
            404,
        )

        library_response = await self.client.post(
            "/api/library",
            headers=self.owner_headers,
            json={"paper_id": "p1", "folder": "Owner folder"},
        )
        self.assertEqual(library_response.status_code, 200, library_response.text)
        library_id = library_response.json()["id"]

        other_library = (await self.client.get("/api/library", headers=self.other_headers)).json()["data"]
        self.assertNotIn(library_id, [item["recordId"] for item in other_library])
        self.assertEqual(
            (await self.client.delete(f"/api/library/{library_id}", headers=self.other_headers)).status_code,
            404,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
