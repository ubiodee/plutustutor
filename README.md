---
title: Plutus Learning Recommender
emoji: 📚
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: "4.44.0"
app_file: app.py
pinned: false
---

# Plutus Learning Material Recommender

Simple content-based recommendation system built on the Plutus Learner RAG corpus.

## Features
- BM25 ranking (pure Python, zero heavy dependencies)
- Query-based recommendations
- Topic-based recommendations
- Filter by tool (plinth / cardano)
- Runs on Colab CPU and free Hugging Face CPU Spaces

## Local / Colab usage

```bash
# In the plutus_recommender folder
python recommender.py "What is the difference between datum and redeemer?"
```

Or in a notebook:

```python
from recommender import PlutusRecommender
rec = PlutusRecommender()
results = rec.recommend("Plutus V3 validators and ScriptContext", k=5)
for r in results:
    print(r["title"], r["score"], r["url"])
```

## Deploy to Hugging Face Space (CPU)

1. Create a new **Gradio** Space on Hugging Face.
2. Upload the entire `plutus_recommender/` folder contents:
   - `app.py`
   - `recommender.py`
   - `rag.py`
   - `data/` (the index folder)
   - `requirements.txt`
   - `README.md` (this file)
3. The Space will start automatically. No GPU needed.

## Optional: Dense / Hybrid mode

For semantic recommendations install FastEmbed (still CPU):

```bash
pip install fastembed numpy
```

Then in code:

```python
# First build vectors (one-time, in Colab)
from rag import embed_index
embed_index("data/index")

# Then
rec = PlutusRecommender(mode="hybrid")
```

## Corpus note

The bundled index contains 15 bootstrap summary chunks.  
To expand the corpus, use the original `ingest.py` from the RAG bundle against `sources.json`.
