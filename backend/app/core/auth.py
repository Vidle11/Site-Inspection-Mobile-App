from dataclasses import dataclass
from uuid import UUID

from fastapi import Header

from app.models.entities import Role


@dataclass
class AuthContext:
    tenant_id: str
    user_id: UUID
    role: Role


async def get_auth_context(
    x_tenant_id: str = Header(default="default", alias="X-Tenant-ID"),
    x_user_id: str = Header(default="00000000-0000-0000-0000-000000000001", alias="X-User-ID"),
    x_user_role: str = Header(default="INSPECTOR", alias="X-User-Role"),
) -> AuthContext:
    return AuthContext(tenant_id=x_tenant_id, user_id=UUID(x_user_id), role=Role(x_user_role))
