"""
storage.py — thin abstraction over local filesystem and S3.

Detects S3 URIs (s3://bucket/key) and routes operations accordingly.
Credentials use the standard AWS env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
boto3 picks these up automatically; no explicit passing needed.
"""

import io
import json
import os
import shutil
import tempfile
from typing import Iterator

import boto3

# ---------------------------------------------------------------------------
# S3 client — lazily initialised
# ---------------------------------------------------------------------------

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        # boto3 automatically reads AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
        # from the environment (standard AWS SDK behaviour).
        _s3_client = boto3.client("s3")
    return _s3_client


# ---------------------------------------------------------------------------
# URI helpers
# ---------------------------------------------------------------------------

def is_s3(path: str) -> bool:
    return path.startswith("s3://")


def _parse_s3(path: str) -> tuple[str, str]:
    """Return (bucket, key) for an s3:// URI."""
    without_scheme = path[5:]  # strip "s3://"
    parts = without_scheme.split("/", 1)
    bucket = parts[0]
    key = parts[1] if len(parts) > 1 else ""
    return bucket, key


def _make_s3_uri(bucket: str, key: str) -> str:
    return f"s3://{bucket}/{key}"


def s3_join(base: str, *parts: str) -> str:
    """Join an S3 URI with sub-path components."""
    result = base.rstrip("/")
    for part in parts:
        result = result.rstrip("/") + "/" + part.lstrip("/")
    return result


def s3_dirname(path: str) -> str:
    """Return the parent URI of an S3 path (equivalent to os.path.dirname)."""
    stripped = path.rstrip("/")
    idx = stripped.rfind("/")
    if idx <= len("s3://"):
        return stripped
    return stripped[:idx]


# ---------------------------------------------------------------------------
# Path helpers that work for both local and s3://
# ---------------------------------------------------------------------------

def join(base: str, *parts: str) -> str:
    if is_s3(base):
        return s3_join(base, *parts)
    return os.path.join(base, *parts)


def dirname(path: str) -> str:
    if is_s3(path):
        return s3_dirname(path)
    return os.path.dirname(path)


def basename(path: str) -> str:
    if is_s3(path):
        return path.rstrip("/").rsplit("/", 1)[-1]
    return os.path.basename(path)


# ---------------------------------------------------------------------------
# Filesystem-like operations
# ---------------------------------------------------------------------------

def makedirs(path: str, exist_ok: bool = True) -> None:
    """Create local directory; no-op for S3 (keys imply hierarchy)."""
    if not is_s3(path):
        os.makedirs(path, exist_ok=exist_ok)


def isfile(path: str) -> bool:
    if is_s3(path):
        bucket, key = _parse_s3(path)
        if not key:
            return False
        try:
            _get_s3_client().head_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False
    return os.path.isfile(path)


def isdir(path: str) -> bool:
    """For S3, 'directory exists' means at least one key with that prefix exists."""
    if is_s3(path):
        bucket, prefix = _parse_s3(path)
        prefix = prefix.rstrip("/") + "/"
        try:
            resp = _get_s3_client().list_objects_v2(
                Bucket=bucket, Prefix=prefix, MaxKeys=1
            )
            return bool(resp.get("Contents"))
        except Exception:
            return False
    return os.path.isdir(path)


def listdir(path: str) -> list[str]:
    """
    List immediate children of a directory.
    For S3, returns 'directory' names (common prefixes) and file keys (last component).
    """
    if is_s3(path):
        bucket, prefix = _parse_s3(path)
        prefix = prefix.rstrip("/") + "/"
        client = _get_s3_client()
        results = set()
        kwargs = {"Bucket": bucket, "Prefix": prefix, "Delimiter": "/"}
        while True:
            resp = client.list_objects_v2(**kwargs)
            for cp in resp.get("CommonPrefixes", []):
                # e.g. "study_artifacts/study_id/D2026-07-14__T14-12/"
                child = cp["Prefix"][len(prefix):].rstrip("/")
                if child:
                    results.add(child)
            for obj in resp.get("Contents", []):
                rel = obj["Key"][len(prefix):]
                # only immediate children (no further '/')
                if rel and "/" not in rel:
                    results.add(rel)
            if resp.get("IsTruncated"):
                kwargs["ContinuationToken"] = resp["NextContinuationToken"]
            else:
                break
        return sorted(results)
    return os.listdir(path)


def walk(path: str) -> Iterator[tuple[str, list[str], list[str]]]:
    """
    Yield (root, dirs, files) like os.walk.
    For S3, root is an S3 URI; dirs/files are plain names.
    """
    if is_s3(path):
        bucket, prefix = _parse_s3(path)
        prefix = prefix.rstrip("/") + "/"
        client = _get_s3_client()
        # Collect all keys under prefix
        all_keys = []
        kwargs = {"Bucket": bucket, "Prefix": prefix}
        while True:
            resp = client.list_objects_v2(**kwargs)
            for obj in resp.get("Contents", []):
                all_keys.append(obj["Key"])
            if resp.get("IsTruncated"):
                kwargs["ContinuationToken"] = resp["NextContinuationToken"]
            else:
                break

        # Group keys by their immediate parent 'directory'
        from collections import defaultdict
        dir_contents: dict[str, dict] = defaultdict(lambda: {"dirs": set(), "files": set()})

        for key in all_keys:
            rel = key[len(prefix):]  # relative to root prefix
            parts = rel.split("/")
            # Build a set of (dir, child) pairs for each level
            for depth in range(len(parts)):
                parent_parts = parts[:depth]
                child = parts[depth]
                parent_key = "/".join(parent_parts)
                if depth < len(parts) - 1:
                    dir_contents[parent_key]["dirs"].add(child)
                else:
                    dir_contents[parent_key]["files"].add(child)

        def _yield(rel_prefix: str):
            bucket_prefix = prefix + rel_prefix
            root_uri = _make_s3_uri(bucket, bucket_prefix.rstrip("/"))
            info = dir_contents.get(rel_prefix.rstrip("/"), {"dirs": set(), "files": set()})
            dirs = sorted(info["dirs"])
            files = sorted(info["files"])
            yield root_uri, dirs, files
            for d in dirs:
                child_rel = (rel_prefix.rstrip("/") + "/" + d).lstrip("/")
                yield from _yield(child_rel + "/")

        yield from _yield("")
    else:
        yield from os.walk(path)


def read_text(path: str, encoding: str = "utf-8", errors: str = "strict") -> str:
    if is_s3(path):
        return read_bytes(path).decode(encoding, errors=errors)
    with open(path, "r", encoding=encoding, errors=errors) as f:
        return f.read()


def read_bytes(path: str) -> bytes:
    if is_s3(path):
        bucket, key = _parse_s3(path)
        resp = _get_s3_client().get_object(Bucket=bucket, Key=key)
        return resp["Body"].read()
    with open(path, "rb") as f:
        return f.read()


def write_text(path: str, content: str, encoding: str = "utf-8") -> None:
    if is_s3(path):
        bucket, key = _parse_s3(path)
        _get_s3_client().put_object(
            Bucket=bucket,
            Key=key,
            Body=content.encode(encoding),
            ContentType="text/plain",
        )
    else:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding=encoding) as f:
            f.write(content)


def write_json(path: str, data: object) -> None:
    content = json.dumps(data, indent=4)
    if is_s3(path):
        bucket, key = _parse_s3(path)
        _get_s3_client().put_object(
            Bucket=bucket,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="application/json",
        )
    else:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(content)


def read_json(path: str) -> object:
    return json.loads(read_text(path))


def write_bytes(path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    if is_s3(path):
        bucket, key = _parse_s3(path)
        _get_s3_client().put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
    else:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)


def rmtree(path: str) -> None:
    """Delete a directory (local) or all objects under a prefix (S3)."""
    if is_s3(path):
        bucket, prefix = _parse_s3(path)
        prefix = prefix.rstrip("/") + "/"
        client = _get_s3_client()
        keys = []
        kwargs = {"Bucket": bucket, "Prefix": prefix}
        while True:
            resp = client.list_objects_v2(**kwargs)
            for obj in resp.get("Contents", []):
                keys.append({"Key": obj["Key"]})
            if resp.get("IsTruncated"):
                kwargs["ContinuationToken"] = resp["NextContinuationToken"]
            else:
                break
        if keys:
            for i in range(0, len(keys), 1000):
                client.delete_objects(
                    Bucket=bucket,
                    Delete={"Objects": keys[i : i + 1000], "Quiet": True},
                )
    else:
        if os.path.isdir(path):
            shutil.rmtree(path)


def upload_dir(local_dir: str, s3_path: str) -> None:
    """
    Upload all files from a local directory to an S3 path (recursively).
    s3_path should be an s3:// URI that represents the destination 'directory'.
    """
    bucket, prefix = _parse_s3(s3_path)
    prefix = prefix.rstrip("/")
    client = _get_s3_client()
    for root, dirs, files in os.walk(local_dir):
        for filename in files:
            local_path = os.path.join(root, filename)
            relative_path = os.path.relpath(local_path, local_dir)
            s3_key = prefix + "/" + relative_path.replace(os.sep, "/")
            client.upload_file(local_path, bucket, s3_key)
