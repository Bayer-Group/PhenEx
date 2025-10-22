#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "fastembed",
# ]
# ///
# TODO: [ ] refactor to RAG system

from fastembed import TextEmbedding
import os


RAG_MODEL_NAME = os.environ.get("RAG_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
RAG_CACHE = os.environ.get("RAG_CACHE", "./_model_cache")
RAG_WEIGHTS_PATH = os.environ.get("RAG_WEIGHTS_PATH", "/data/_model_cache/fast-all-MiniLM-L6-v2")
# from hf.co: _model_cache/models--qdrant--all-MiniLM-L6-v2-onnx/snapshots/5f1b8cd78bc4fb444dd171e59b18f3a3af89a079
# NOT  hf.co: _model_cache/fast-all-MiniLM-L6-v2


def main():
    model_cache_dirname = download_model()
    print(f"Directory name: {model_cache_dirname}")


def download_model(text_model_name=RAG_MODEL_NAME, dir=RAG_CACHE) -> str:
    emb = TextEmbedding(
      model_name=text_model_name,
      cache_dir = dir
    )
    return emb.model._model_dir


def load_rag_model(text_model_name: str = RAG_MODEL_NAME, model_path: str = RAG_WEIGHTS_PATH):
    if model_path and os.path.exists(model_path):
        logger.info(f"RAG will load weights from: {model_path}")    
        try:
            # Attempt to load model from localy downloaded weights
            embeddings_model = TextEmbedding(
                model_name=text_model_name,
                specific_model_path=model_path
            )
        except Exception as e:
            if type(e).__name__ == "NoSuchFile":
                logger.warning(f"RAG failed to load weights locally.")

    # Attempt to download model if it was not loaded locally
    if not embeddings_model:
        try:
            logger.info(f"RAG will attempt to download weights...")
            embeddings_model = TextEmbedding(model_name=text_model_name)
        except Exception as e:
            logger.error(f"RAG failed to download weights: {type(e).__name__}!")
    return embeddings_model


if __name__ == "__main__":
    main()
