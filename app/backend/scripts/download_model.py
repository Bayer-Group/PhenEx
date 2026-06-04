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
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


RAG_MODEL_NAME = os.environ.get(
    "RAG_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2"
)
RAG_CACHE = os.environ.get("RAG_CACHE", "/app/data/")


def main():
    logger.info("🚀 Starting RAG model download process...")
    model_cache_dirname = download_model()
    logger.info(f"🎯 Final model directory: {model_cache_dirname}")
    print(f"Directory name: {model_cache_dirname}")


def download_model(text_model_name=RAG_MODEL_NAME, dir=RAG_CACHE) -> str:
    logger.info(f"📥 Downloading RAG model: {text_model_name}")
    logger.info(f"💾 Cache directory: {dir}")

    emb = TextEmbedding(model_name=text_model_name, cache_dir=dir)

    model_dir = emb.model._model_dir
    logger.info(f"✅ Model successfully cached to: {model_dir}")

    # Log the contents of the cache directory
    try:
        cache_contents = os.listdir(dir)
        logger.info(f"📁 Cache directory now contains: {cache_contents}")
    except Exception as e:
        logger.warning(f"Could not list cache directory: {e}")

    return model_dir


def load_rag_model(text_model_name: str = RAG_MODEL_NAME, cache_dir: str = RAG_CACHE):
    """
    Load RAG model, using cache if available or downloading if needed.
    Let fastembed handle all cache logic internally.
    """
    logger.info(f"🔍 Loading RAG model: {text_model_name}")
    logger.info(f"📂 Using cache directory: {cache_dir}")

    try:
        # Simply let fastembed handle cache detection and loading
        # It will use cached version if available, download if not
        embeddings_model = TextEmbedding(
            model_name=text_model_name, cache_dir=cache_dir
        )
        logger.info(f"✅ Successfully loaded RAG model!")
        logger.info(f"📊 Model details: {embeddings_model.model.model_name}")
        return embeddings_model

    except Exception as e:
        logger.error(f"� Failed to load RAG model: {type(e).__name__} - {e}")
        raise


if __name__ == "__main__":
    main()
