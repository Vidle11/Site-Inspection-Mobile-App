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
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    x_user_id: UUID = Header(..., alias="X-User-ID"),
    x_user_role: Role = Header(..., alias="X-User-Role"),
) -> AuthContext:
    return AuthContext(tenant_id=x_tenant_id, user_id=x_user_id, role=x_user_role)
