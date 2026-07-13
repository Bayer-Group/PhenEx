"""Chat history API routes."""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import logging

from ..database import db_manager
from ..utils.auth import get_authenticated_user_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


class CreateSessionRequest(BaseModel):
    study_id: Optional[str] = None
    title: Optional[str] = None
    session_id: Optional[str] = None


class AddMessageRequest(BaseModel):
    study_id: Optional[str] = None
    role: str  # "user" | "assistant"
    text: str
    metadata: Optional[dict] = None


class UpdateTitleRequest(BaseModel):
    title: str


@router.post("/sessions")
async def create_session(request: Request, body: CreateSessionRequest):
    """Create (or ensure) a chat session."""
    user_id = get_authenticated_user_id(request)
    try:
        session = await db_manager.create_chat_session(
            user_id=user_id,
            study_id=body.study_id,
            title=body.title,
            session_id=body.session_id,
        )
        return session
    except Exception as e:
        logger.error(f"create_session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def get_sessions(request: Request, study_id: Optional[str] = None):
    """List chat sessions for a user (optionally filtered by study)."""
    user_id = get_authenticated_user_id(request)
    try:
        sessions = await db_manager.get_chat_sessions(
            user_id=user_id, study_id=study_id
        )
        return sessions
    except Exception as e:
        logger.error(f"get_sessions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str, request: Request):
    """Get all messages for a session (user must own the session)."""
    user_id = get_authenticated_user_id(request)
    try:
        messages = await db_manager.get_chat_messages(
            session_id=session_id, user_id=user_id
        )
        return messages
    except Exception as e:
        logger.error(f"get_messages error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/messages")
async def add_message(session_id: str, request: Request, body: AddMessageRequest):
    """Append a message to a session."""
    user_id = get_authenticated_user_id(request)
    if body.role not in ("user", "assistant"):
        raise HTTPException(
            status_code=400, detail="role must be 'user' or 'assistant'"
        )
    try:
        msg = await db_manager.add_chat_message(
            session_id=session_id,
            user_id=user_id,
            study_id=body.study_id,
            role=body.role,
            text=body.text,
            metadata=body.metadata,
        )
        return msg
    except Exception as e:
        logger.error(f"add_message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/sessions/{session_id}")
async def update_title(session_id: str, request: Request, body: UpdateTitleRequest):
    """Update the title of a chat session."""
    user_id = get_authenticated_user_id(request)
    try:
        await db_manager.update_chat_session_title(
            session_id=session_id, user_id=user_id, title=body.title
        )
        return {"ok": True}
    except Exception as e:
        logger.error(f"update_title error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, request: Request):
    """Delete a chat session and all its messages."""
    user_id = get_authenticated_user_id(request)
    try:
        await db_manager.delete_chat_session(session_id=session_id, user_id=user_id)
        return {"ok": True}
    except Exception as e:
        logger.error(f"delete_session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
