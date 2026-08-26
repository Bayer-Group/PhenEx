from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel
import jwt
from argon2 import PasswordHasher

# Create router for auth endpoints
router = APIRouter()

# Import dependencies
from ..config import config
from ..domain.user import User, new_userid
from .. import database as db


class RegisterData(BaseModel):
    email: str
    password: str
    username: str | None


class LoginData(BaseModel):
    email: str
    password: str


@router.post("/register", tags=["auth"])
async def register(request: Request, user_data: RegisterData):
    """
    Registers a new User.
    """

    if not config["auth"]["password"].exists():
        raise ValueError("Registration is deactivated")
    if not (
        config["auth"]["password"]["secret"].exists()
        and config["auth"]["password"]["secret"].get(str)
    ):
        raise ValueError("Registration is deactivated")

    if not user_data.email or not user_data.password:
        return {"error": "Email and password are required."}, 400

    session = request["db_session"]

    if (
        not user_data.email
        or db.get_user_by_email(session, user_data.email) is not None
    ):
        raise ValueError("Registration failed.")

    ph = PasswordHasher()
    hashed_pw = ph.hash(user_data.password)

    user = User(
        id=new_userid(),
        email=user_data.email,
        password_hash=hashed_pw,
        external_id="password",
        name=user_data.username,
    )

    session.add(user)
    session.commit()

    return {
        "status": "success",
        "message": f"User {user.id} registered successfully.",
    }


@router.post("/login", tags=["auth"])
async def login(request: Request, login_data: LoginData):
    """
    Verifies the log in credentials and returns a new auth token.
    """

    if not config["auth"]["password"].exists():
        raise ValueError("Password based Login is deactivated.")
    if not (
        config["auth"]["password"]["secret"].exists()
        and config["auth"]["password"]["secret"].get(str)
    ):
        raise ValueError("Password based Login is deactivated")

    session = request["db_session"]

    user = db.get_user_by_email(session, login_data.email)
    if not (user and user.password_hash):
        raise ValueError("Login failed.")

    ph = PasswordHasher()
    print(ph.hash("12345678"))
    try:
        ph.verify(user.password_hash, login_data.password)
    except Exception:
        raise ValueError("Login failed.")

    if ph.check_needs_rehash(user.password_hash):
        user.password_hash = ph.hash(login_data.password)

    secret = config["auth"]["password"]["secret"].get(str)
    payload = {
        "sub": str(user.id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "name": user.name,
        "email": user.email,
    }
    token = jwt.encode(payload, secret, algorithm="HS256")

    return {"auth_token": token}
