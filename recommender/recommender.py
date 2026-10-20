"""
Simple content-based recommendation system for Plutus learning materials.
Built on top of the Plutus Learner RAG corpus.

Uses pure-Python BM25 (from rag.py) by default — no heavy dependencies.
Optional: dense embeddings via FastEmbed for semantic recommendations (CPU-friendly).

Designed to run on Colab CPU and deploy as a Hugging Face CPU Space.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from rag import Retriever, read_jsonl

ROOT = Path(__file__).resolve().parent
DEFAULT_INDEX = ROOT / "data" / "index"


class PlutusRecommender:
    """
    Content-based recommender over the Plutus corpus chunks.

    "Training" consists of loading / building the index (instant on this small corpus).
    Recommendations are ranked by BM25 relevance (or hybrid if dense vectors exist).
    """

    def __init__(self, index_dir: str | Path = DEFAULT_INDEX, mode: str = "bm25"):
        self.index_dir = Path(index_dir)
        self.mode = mode
        self.retriever = Retriever(self.index_dir, mode=mode)
        self.chunks = read_jsonl(self.index_dir / "chunks.jsonl")
        self.manifest = self.retriever.manifest
        print(f"Loaded {len(self.chunks)} chunks from {self.manifest.get('corpus_mode', 'unknown')} corpus.")

    def recommend(
        self,
        query: str,
        k: int = 5,
        tool: str = "all",
        exclude_ids: list[str] | None = None,
        include_historical: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Recommend the most relevant learning materials for a query.

        Args:
            query: Natural language description of what the user wants to learn
                   (e.g. "datum and redeemer", "how validators work in Plutus V3").
            k: Number of recommendations to return.
            tool: Filter by tool ("plinth", "cardano", "all", etc.).
            exclude_ids: Chunk IDs the user already knows / has seen.
            include_historical: Include historical/outdated materials.

        Returns:
            List of recommendation dicts with title, url, score, text snippet, etc.
        """
        if not query or not query.strip():
            return []

        hits = self.retriever.search(
            query,
            k=k * 3,  # fetch extra so we can filter
            tool=tool if tool != "all" else "plinth",  # retriever default
            include_historical=include_historical,
        )

        # Manual filter for tool="all" and exclusions (retriever tool filter is limited)
        exclude = set(exclude_ids or [])
        recommendations = []
        for hit in hits:
            if hit["id"] in exclude:
                continue
            if tool != "all" and hit.get("tool") not in (tool, None):
                continue
            # Truncate long text for display
            snippet = hit.get("text", "")
            if len(snippet) > 400:
                snippet = snippet[:400] + "..."
            recommendations.append(
                {
                    "id": hit["id"],
                    "title": hit.get("title", "Untitled"),
                    "section": hit.get("section", ""),
                    "url": hit.get("url", ""),
                    "tool": hit.get("tool", ""),
                    "topics": hit.get("topics", []),
                    "score": round(hit.get("score", 0.0), 4),
                    "snippet": snippet,
                    "status": hit.get("status", ""),
                }
            )
            if len(recommendations) >= k:
                break

        return recommendations

    def list_topics(self) -> list[str]:
        """Return all unique topics in the corpus."""
        topics = set()
        for c in self.chunks:
            topics.update(c.get("topics", []))
        return sorted(topics)

    def recommend_by_topics(self, topics: list[str], k: int = 5) -> list[dict[str, Any]]:
        """Recommend materials related to one or more topics."""
        query = " ".join(topics)
        return self.recommend(query, k=k)

    def get_chunk(self, chunk_id: str) -> dict | None:
        for c in self.chunks:
            if c["id"] == chunk_id:
                return c
        return None


# ---------------------------------------------------------------------------
# Quick demo / CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Plutus learning material recommender")
    parser.add_argument("query", nargs="?", default="datum redeemer validator", help="What do you want to learn?")
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--tool", default="all")
    parser.add_argument("--mode", default="bm25", choices=["bm25", "hybrid"])
    args = parser.parse_args()

    rec = PlutusRecommender(mode=args.mode)
    print(f"\nRecommendations for: {args.query!r}\n")
    results = rec.recommend(args.query, k=args.k, tool=args.tool)
    for i, r in enumerate(results, 1):
        print(f"{i}. [{r['score']:.3f}] {r['title']}")
        print(f"   Tool: {r['tool']} | Topics: {', '.join(r['topics'][:3])}")
        print(f"   URL: {r['url']}")
        print(f"   {r['snippet'][:200]}...\n")
