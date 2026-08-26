import os
from dataclasses import field
from uuid import UUID

from sqlalchemy import UUID as UUID_db
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedAsDataclass, mapped_column
from starlette.authentication import BaseUser


class Base(DeclarativeBase): ...


class UserID(UUID): ...


def new_userid() -> UserID:
    return UserID(bytes=os.urandom(16), version=4)


class User(MappedAsDataclass, BaseUser, Base):
    __tablename__ = "user"

    id: Mapped[UserID] = mapped_column(UUID_db, primary_key=True)
    email: Mapped[str | None]
    password_hash: Mapped[str | None]
    external_id: Mapped[str | None]
    name: Mapped[str]

    _is_authenticated: bool = field(default=False, init=False)

    @property
    def is_authenticated(self) -> bool:
        return self._is_authenticated

    def set_authenticated(self, val: bool):
        self._is_authenticated = val

    @property
    def display_name(self) -> str:
        return self.external_id or self.name

    def __repr__(self) -> str:
        return f"User(id={self.id}, external_id={self.external_id})"

    def __hash__(self) -> int:
        return self.id.int
