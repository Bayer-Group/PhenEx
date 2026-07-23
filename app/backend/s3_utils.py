#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "boto3",
#   "python-dotenv"
# ]
# ///

import boto3
import os
import re
from dotenv import load_dotenv

load_dotenv()

DEFAULT_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
DEFAULT_PREFIX = os.getenv('S3_BUCKET_PREFIX_DEFAULT', 'public/')

if not DEFAULT_BUCKET_NAME:
    raise ValueError(
        "Missing required environment variable: S3_BUCKET_NAME\n"
        "Credentials are read from the standard AWS env vars:\n"
        "  AWS_ACCESS_KEY_ID\n"
        "  AWS_SECRET_ACCESS_KEY\n"
    )

# boto3 reads AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY automatically
s3_client = boto3.client("s3")


def main():
    print(f"Current working directory: {os.getcwd()}")
    print(f"Bucket: {DEFAULT_BUCKET_NAME}")
    print(f"Prefix: {DEFAULT_PREFIX}\n")
    list_s3()
    print("\n--- Uploading site/ ---")
    upload_mkdocs()


def upload_mkdocs(source_dir='./site', prefix=DEFAULT_PREFIX):
    #delete_dir_s3(prefix=prefix)
    upload_dir_s3(source_dir, prefix=prefix)


def list_s3(prefix=DEFAULT_PREFIX, bucket=DEFAULT_BUCKET_NAME, client=s3_client):
    keys = []
    dirs = []
    next_token = ''
    base_kwargs = {
        'Bucket':bucket,
        'Prefix':prefix,
    }
    total_size = 0
    while next_token is not None:
        kwargs = base_kwargs.copy()
        if next_token != '':
            kwargs.update({'ContinuationToken': next_token})
        results = client.list_objects_v2(**kwargs)
        contents = results.get('Contents')
        if contents:
            for i in contents:
                k = i.get('Key')
                if k[-1] != '/':
                    keys.append(k)
                    total_size += i.get('Size')
                else:
                    # TODO: bug: this only prints for directories which are empty – e.g. `public/`, `public/_http_errors/`.
                    dirs.append(k)
        next_token = results.get('NextContinuationToken')

    print('Directories: \n'); print(*dirs, sep='\n')
    print('Keys: \n'); print(*keys, sep='\n')

    # print(f"Directories: \n{'\n'.join(dirs)}")
    # print(f"Keys: \n{'\n'.join(keys)}")

    print(f"\nTotal: {len(dirs)} directories, {len(keys)} files, {sizeof_fmt(total_size)} size.")


def download_s3(prefix=DEFAULT_PREFIX, local='s3_public', junk_prefix=True, bucket=DEFAULT_BUCKET_NAME, client=s3_client):
    """
    params:
    - prefix: pattern to match in s3
    - local: local path to folder in which to place files
    - bucket: s3 bucket with target contents
    - client: initialized s3 client object
    """
    keys = []
    dirs = []
    next_token = ''
    base_kwargs = {
        'Bucket':bucket,
        'Prefix':prefix,
    }
    while next_token is not None:
        kwargs = base_kwargs.copy()
        if next_token != '':
            kwargs.update({'ContinuationToken': next_token})
        results = client.list_objects_v2(**kwargs)
        contents = results.get('Contents')
        for i in contents:
            k = i.get('Key')
            if k[-1] != '/':
                keys.append(k)
            else:
                # if prefix directory/key we skip it
                if k == prefix:
                    continue
                dirs.append(k)
        next_token = results.get('NextContinuationToken')
        print(f'processed {len(contents)} objects...')
    # for d in dirs:
    #     dest_pathname = os.path.join(local, _junk_prefix(d, prefix) if junk_prefix else d)
    #     if not os.path.exists(os.path.dirname(dest_pathname)):
    #         os.makedirs(os.path.dirname(dest_pathname))
    for k in keys:
        dest_pathname = os.path.join(local, _junk_prefix(k, prefix=prefix) if junk_prefix else k)
        if not os.path.exists(os.path.dirname(dest_pathname)):
            os.makedirs(os.path.dirname(dest_pathname))
        print(f'downloading {k} -> { os.path.abspath(dest_pathname) }...')
        client.download_file(bucket, k, dest_pathname)


def _junk_prefix(k, prefix):
    """
    prefix=public
    k=public/assets/asd
    -> assets/asd
    """
    clean_prefix = re.sub(r"^(?:\/)?(.*?)(?:\/)?$", r"\1", prefix, 1)
    junked_key = re.sub(f"^(?:\\/)?({clean_prefix})", "", k, 1)
    junked_key = re.sub(r"^\/*", "", junked_key, 1)
    # print(f'junked {k} -> {junked_key}')
    return junked_key


def sizeof_fmt(num, suffix="B"):
    for unit in ("", "Ki", "Mi", "Gi", "Ti", "Pi", "Ei", "Zi"):
        if abs(num) < 1024.0:
            return f"{num:3.1f}{unit}{suffix}"
        num /= 1024.0
    return f"{num:.1f}Yi{suffix}"


def delete_dir_s3(prefix, bucket=DEFAULT_BUCKET_NAME, client=s3_client):
    keys = []
    next_token = ''
    base_kwargs = {
        'Bucket': bucket,
        'Prefix': prefix,
    }

    while next_token is not None:
        kwargs = base_kwargs.copy()
        if next_token != '':
            kwargs.update({'ContinuationToken': next_token})
        results = client.list_objects_v2(**kwargs)
        contents = results.get('Contents')
        for i in contents:
            keys.append({'Key': i.get('Key')})
        next_token = results.get('NextContinuationToken')

    if keys:
        print(f"Deleting {len(keys)} items from s3://{bucket}/{prefix}")
        delete_responses = []
        for i in range(0, len(keys), 1000):
            delete_responses.append(
                client.delete_objects(
                    Bucket=bucket,
                    Delete={
                        'Objects': keys[i:i + 1000],
                        'Quiet': True
                    }
                )
            )

        # TODO: add how much spaces was freed.
        print(f"\nTotal: deleted {len(keys)} objects.")
        return delete_responses

    return None


def upload_dir_s3(source_dir, bucket=DEFAULT_BUCKET_NAME, prefix=DEFAULT_PREFIX, client=s3_client, regex_filter=None):
    SKIP_PATTERNS = re.compile(r"(^|/)(\.(git|DS_Store)|__pycache__|\.ipynb_checkpoints)(/|$)")
    content_type_map = {
        'css': 'text/css',
        'csv': 'text/csv',
        'gz': 'application/gzip',
        'html': 'text/html',
        'ico': 'image/x-icon',
        'js': 'application/javascript',
        'json': 'application/json',
        'map': 'application/json',
        'md': 'text/markdown',
        'pdf': 'application/pdf',
        'png': 'image/png',
        'svg': 'image/svg+xml',
        'ttf': 'application/x-font-ttf',
        'txt': 'text/plain',
        'wasm': 'application/wasm',
        'xml': 'application/xml',
    }
    content_type_notmapped = []
    uploaded = 0
    for root, dirs, files in os.walk(source_dir):
        dirs[:] = [d for d in dirs if not SKIP_PATTERNS.search(d)]
        for filename in files:
            if SKIP_PATTERNS.search(filename):
                continue

            local_path = os.path.join(root, filename)
            relative_path = os.path.relpath(local_path, source_dir)
            s3_path = os.path.join(prefix, relative_path)

            if regex_filter and not re.match(regex_filter, relative_path):
                continue

            _extraArgs = {}
            ext = filename.rsplit('.', 1)[-1] if '.' in filename else ''
            if content_type := content_type_map.get(ext):
                _extraArgs['ContentType'] = content_type
            else:
                content_type_notmapped.append(ext)

            try:
                print("Uploading %s..." % s3_path)
                s3_client.upload_file(local_path, bucket, s3_path, ExtraArgs=_extraArgs)
                uploaded += 1
            except Exception as e:
                print(f"Failed to upload {local_path} to {s3_path}! Error: {e}")

    content_type_notmapped = set(content_type_notmapped)
    if content_type_notmapped:
        print(f"not mapped ContentType for: {content_type_notmapped}")
    print(f"\nTotal: uploaded {uploaded} files.")


if __name__ == "__main__":
    main()
