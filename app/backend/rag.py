import os, json, glob
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import faiss
from fastembed import TextEmbedding
import numpy as np
import ast
import phenex
from examples import EXAMPLES
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a FastAPI router
router = APIRouter()

# Load a pre-trained sentence embedding model
embeddings_model = TextEmbedding('sentence-transformers/all-MiniLM-L6-v2')


def get_phenex_context_documents():
    # get context documents for LLM layer
    base_dir = os.path.dirname(phenex.__file__)
    python_files = list(
        set(glob.glob(os.path.join(base_dir, "**/**/*.py"), recursive=True))
    )
    exclude_paths = ['/aggregators', '/filters', '/test/', '/reporting/', 'ibis_connect.py', 'sim.py', 'tables.py', 'logging.py', '__init__.py']
    python_files = [f for f in python_files if not any([x in f for x in exclude_paths])]
    logger.info(f"LLM context files found: {len(python_files)}")

    # parse the python files for the class definitions
    documents = []
    for file_path in python_files:
        if not any([x in file_path for x in exclude_paths]):
            with open(file_path, "r") as f:
                file_content = f.read()
                try:
                    tree = ast.parse(file_content)
                    for node in ast.walk(tree):
                        if isinstance(node, ast.ClassDef):
                            class_name = node.name
                            docstring = ast.get_docstring(node)
                            if not docstring:
                                raise ValueError(f"No docstring found for file {f}")
                            document = f''''
FILE: {file_path}
CLASS: {class_name}
DOCSTRING: 
{docstring}
'''
                            documents.append(document)
                            logger.info(document)
                except Exception as e:
                    logger.error(f"Failed to parse {file_path}: {e}")


    for example in EXAMPLES:
        document = f"\n\nEXAMPLE COHORT DEFINITIONS IN JSON FORMAT:\n"
        document += json.dumps(example, indent=4)
        documents.append(document)

    logger.info(f"LLM context documents: {len(documents)}")
    return documents


def build_phenex_rag_index():
    """
    Builds a FAISS index for Phenex.

    Returns:
        index: The FAISS index.
        document_map: A mapping of document IDs to the phenex context documents.
    """
    phenex_context_documents = get_phenex_context_documents()

    # Generate embeddings for the documents
    embeddings = np.array(list(embeddings_model.embed(phenex_context_documents)))

    # Create a FAISS index
    dimension = len(embeddings[0])
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)

    # Map document IDs to the original documents
    document_map = {i: doc for i, doc in enumerate(phenex_context_documents)}

    return index, document_map


phenex_rag_index, phenex_document_map = build_phenex_rag_index()


def query_faiss_index(query, top_k=5):
    """
    Queries the FAISS index to retrieve the most relevant documents.

    Args:
        query (str): The query string.
        index: The FAISS index.
        document_map: A mapping of document IDs to the original documents.
        model: The sentence embedding model.
        top_k (int): The number of top documents to retrieve.

    Returns:
        List[str]: The most relevant documents.
    """
    # Generate the embedding for the query
    query_embedding = np.array(list(embeddings_model.embed([query]))[0])

    # Ensure the query_embedding is a 2D array
    query_embedding = query_embedding.reshape(1, -1)

    # Search the FAISS index
    distances, indices = phenex_rag_index.search(query_embedding, top_k)

    # Retrieve the top documents
    results = [phenex_document_map[idx] for idx in indices[0]]

    return results


# Define a Pydantic model for the request body
class QueryRequest(BaseModel):
    query: str
    top_k: int = 10

@router.post("/query")
async def query_rag(request: QueryRequest):
    """
    Endpoint to query the FAISS index and retrieve the most relevant documents.

    Args:
        request (QueryRequest): The request body containing the query string and top_k value.

    Returns:
        List[str]: The most relevant documents.
    """
    try:
        results = query_faiss_index(
            query=request.query,
            index=phenex_rag_index,
            document_map=phenex_document_map,
            model=model,
            top_k=request.top_k
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying FAISS index: {str(e)}")


