import logging
import typing
from operator import attrgetter
from typing import Optional, Protocol
import uuid

import confuse  # type: ignore
import jwt
import requests
from authlib.jose import JsonWebToken, JWTClaims, errors  # type: ignore
from pydantic import BaseModel
from starlette.authentication import (
    AuthCredentials,
    AuthenticationBackend,
    AuthenticationError,
)
from starlette.requests import HTTPConnection
from starlette.types import Receive, Scope, Send

from .domain.user import User, UserID, new_userid
from . import database as db

# import only for typing
if typing.TYPE_CHECKING:
    from confuse import ConfigView
    from sqlalchemy.orm import sessionmaker, Session

logger = logging.getLogger(__name__)


class DBSessionMiddleware:
    def __init__(self, app, sessionmaker: "sessionmaker"):
        self.app = app
        self.sessionmaker = sessionmaker

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] not in ("http", "websocket"):  # pragma: no cover
            await self.app(scope, receive, send)
            return

        with self.sessionmaker() as s:
            scope["db_session"] = s
            await self.app(scope, receive, send)


class Authenticator(Protocol):  # pragma: no cover
    def __init__(self, config, sessionmaker: "sessionmaker"): ...

    def authenticate(self, sessionmaker: "sessionmaker", token: str) -> None: ...

    @property
    def error(self) -> Exception | None: ...

    @property
    def credentials(self) -> AuthCredentials | None: ...

    @property
    def user(self) -> User | None: ...


class AuthBackend(AuthenticationBackend):
    def __init__(self, config: "ConfigView", sessionmaker: "sessionmaker"):
        self.authenticators: list[Authenticator] = []

        with sessionmaker() as session:
            if config["anonymous"].exists():
                logger.info("Authorization method 'anonymous' is enabled")
                self.authenticators.append(
                    AnonymousAuthenticator(config["anonymous"], session)
                )

            if config["ad"].exists():
                logger.info("Authorization method 'ad' is enabled")
                self.authenticators.append(AzureADAuthenticator(config["ad"], session))

            if config["password"].exists():
                logger.info("Authorization method 'password' is enabled")
                self.authenticators.append(PasswordAuthenticator(config["password"]))

        if len(self.authenticators) == 0:
            raise Exception("No authentication method was defined.")

    async def authenticate(
        self, conn: HTTPConnection
    ) -> Optional[tuple[AuthCredentials, User]]:
        """
        authenticate is called for every request that is configured to
        be restricted.
        """
        auth = conn.headers.get("Authorization", None)
        session: "Session" = conn["db_session"]

        if auth is None:
            return None

        scheme, _, token = auth.partition(" ")
        if scheme.lower() != "bearer":
            return None

        for a in self.authenticators:
            a.authenticate(session, token)
            if not a.error:
                break

        successful_auths = filter(lambda a: a.user is not None, self.authenticators)

        try:
            authenticator = next(successful_auths)
            assert authenticator.credentials is not None
            assert authenticator.user is not None

            authenticator.user.set_authenticated(True)

            return authenticator.credentials, authenticator.user
        except StopIteration:
            raise next(map(attrgetter("error"), self.authenticators))


class AnonymousAuthenticator:
    def __init__(self, config: "ConfigView", session: "Session"):
        self._token = config["token"].get(str)

        with session:
            self._user_id = UserID(config["user_id"].get(str))
            if not db.get_user_by_id(session, self._user_id):
                raise ValueError(
                    f"Anonymous user with id '{self._user_id}' does not exist"
                )

        self._error: Exception | None = None
        self._credentials: AuthCredentials | None = None
        self._user: User | None = None

    def authenticate(self, conn_session: "Session", token: str) -> None:
        self._user = None
        self._credentials = None
        self._error = None

        if self._token == token:
            user = db.get_user_by_id(conn_session, self._user_id)
            if not user:  # pragma: no cover - happens when user was deleted after init
                self._error = AuthenticationError("Dev user does not exist anymore")
                return
            user.set_authenticated(True)
            self._credentials = AuthCredentials(["authenticated"])
            self._user = user
        else:
            self._error = AuthenticationError("Invalid Bearer token")

    @property
    def error(self) -> Exception | None:
        if self._error is None and self._user is None:
            raise Exception("authenticate was not called")
        return self._error

    @property
    def credentials(self) -> AuthCredentials | None:
        if self._credentials is None and self._error is None:
            raise Exception("authenticate was not called")
        return self._credentials

    @property
    def user(self) -> User | None:
        if self._user is None and self._error is None:
            raise Exception("authenticate was not called")
        return self._user


class PasswordAuthenticator:
    def __init__(self, config: "ConfigView"):
        self._secret = config["secret"].get(str)

        if not self._secret:
            raise ValueError("Password based Login is misconfigured.")

        self._error: Exception | None = None
        self._credentials: AuthCredentials | None = None
        self._user: User | None = None

    def authenticate(self, conn_session: "Session", token: str) -> None:
        try:
            payload = jwt.decode(token, self._secret, algorithms=["HS256"])
        except Exception as e:
            print(f"Unable to decode Bearer Token: '{str(e)} :: {token[:8]}...'")
            self._error = AuthenticationError("Invalid Bearer token")
            return

        user_id = payload["sub"]
        user = db.get_user_by_id(conn_session, user_id)

        if not user:
            self._error = AuthenticationError("User is not available anymore")
            return

        user.set_authenticated(True)
        self._credentials = AuthCredentials(["authenticated"])
        self._user = user

    @property
    def error(self) -> Exception | None:
        if self._error is None and self._user is None:
            raise Exception("authenticate was not called")
        return self._error

    @property
    def credentials(self) -> AuthCredentials | None:
        if self._credentials is None and self._error is None:
            raise Exception("authenticate was not called")
        return self._credentials

    @property
    def user(self) -> User | None:
        if self._user is None and self._error is None:
            raise Exception("authenticate was not called")
        return self._user


class AzureADAuthenticator:

    class ClaimsConfig(BaseModel):
        name: str
        mapped_to: str

    def __init__(self, config: "ConfigView", session: "Session"):
        template = confuse.Sequence({"name": str, "mapped_to": str})
        extra_claims = [self.ClaimsConfig(**c) for c in config["claims"].get(template)]

        self._aud = config["aud"].get(str)
        self._extra_claims = extra_claims
        self._tenant = config["tenant"].get(str)

        self._configure_ad()
        self.session = session
        self._error: Exception | None = None
        self._credentials: AuthCredentials | None = None
        self._user: User | None = None

    @staticmethod
    def __claim_options(tenant: str, aud: str):
        return {
            "iss": {
                "essential": True,
                "values": [
                    f"https://login.microsoftonline.com/{tenant}/v2.0",  # noqa
                    f"https://sts.windows.net/{tenant}/",
                ],
            },
            "aud": {
                "essential": True,
                "value": f"{aud}",
            },
            "exp": {"essential": True},
            "iat": {"essential": True},
        }

    def _configure_ad(self):
        self._claim_options = self.__claim_options(self._tenant, self._aud)
        self._claim_map = {}

        for claim in self._extra_claims:
            self._claim_options[claim.name] = {"essential": True}
            self._claim_map[claim.mapped_to] = claim.name

        if self._claim_map.keys() != {"external_id", "email", "name"}:
            raise ValueError(
                "There must be claims mapped to 'external_id' and 'name of the users"
            )

        keys_url = (
            f"https://login.microsoftonline.com/{self._tenant}/discovery/v2.0/keys"
        )
        self.keys = requests.get(keys_url).json()

    @property
    def error(self) -> Exception | None:
        if self._error is None and self._user is None:
            raise Exception("authenticate was not called")
        return self._error

    @property
    def credentials(self) -> AuthCredentials | None:
        if self._credentials is None and self._error is None:
            raise Exception("authenticate was not called")
        return self._credentials

    @property
    def user(self) -> User | None:
        if self._user is None and self._error is None:
            raise Exception("authenticate was not called")
        return self._user

    def authenticate(self, conn_session: "Session", token: str):
        self._user = None
        self._credentials = None
        self._error = None

        try:
            claims = self._extract_claims(token)
            self._credentials = AuthCredentials(["authenticated"])
            self._user = self._load_user(conn_session, claims)
        except Exception as e:
            print(f"Unable to decode Bearer Token: '{e} :: {token[:8]}...'")
            self._error = AuthenticationError("Unable to decode Bearer token")

    def _extract_claims(self, token) -> JWTClaims:
        """
        decodes and validates the jwt token, assuming RS256 algorithm; returns claims
        """
        jwt = JsonWebToken(["RS256"])

        claims = None

        for try_nr in range(3):
            try:
                claims = jwt.decode(
                    token,
                    key=self.keys,
                    claims_options=self._claim_options,
                )
                claims.validate()
                break
            except ValueError as e:
                if "Invalid JSON Web Key Set" in str(e):
                    logger.info(
                        "Recieved error 'Invalid JSON Web Key Set' on token decoding."
                        " Reloading keys from AD. (try %d/3)",
                        try_nr + 1,
                    )
                    self._configure_ad()
                else:
                    raise e

        if not claims:
            raise errors.DecodeError("Invalid Bearer token")

        return claims

    def _load_user(self, session: "Session", claims) -> User:
        """
        based on the external ID stored in token claims, load the
        corresponding user from the DB into the scope.
        If the user does not exist yet in db, create them.
        """
        external_id = claims[self._claim_map["external_id"]]
        name = claims[self._claim_map["name"]]

        if not external_id or not name:
            raise AuthenticationError(
                "The following claims must be non-empty: "
                f'{self._claim_map["external_id"]}, {self._claim_map["email"]}, '
                f'{self._claim_map["name"]}'
            )

        user: Optional[User] = db.get_user_by_external_id(session, external_id)

        if user is None:
            return self._create_new_user(session, external_id, name, claims)

        if name != user.name:
            user.name = name

        session.commit()

        return user

    def _create_new_user(
        self, session: "Session", external_id: str, name: str, claims: dict
    ) -> User:
        user = User(
            id=new_userid(),
            email=claims["email"] if "email" in claims else None,
            password_hash=None,
            external_id=external_id,
            name=name,
        )

        session.add(user)
        session.commit()

        return user
