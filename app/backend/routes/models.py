from typing import Optional
from pydantic import BaseModel


class CodelistMetadata(BaseModel):
    """Metadata for a codelist file without full contents."""

    id: str
    filename: str
    codelists: list[str]
    code_column: Optional[str] = None
    code_type_column: Optional[str] = None
    codelist_column: Optional[str] = None


class CodelistContents(BaseModel):
    """Contents of a codelist file."""

    data: dict[str, list]
    headers: list[str]


class CodelistFile(BaseModel):
    """Complete codelist file with all data and metadata."""

    id: str
    filename: str
    code_column: str
    code_type_column: str
    codelist_column: str
    contents: CodelistContents
    codelists: list[str]
    version: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ColumnMapping(BaseModel):
    """Column mapping configuration for a codelist."""

    code_column: str
    code_type_column: str
    codelist_column: str


class StatusResponse(BaseModel):
    """Standard status response."""

    status: str
    message: str


class ColumnMappingUpdateResponse(StatusResponse):
    """Response for column mapping update including recalculated codelists."""

    codelists: list[str]
