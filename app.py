"""
Hugging Face Space (Gradio) for the Plutus Learning Material Recommender.

CPU-only. No GPU required. Works with the free HF Space hardware.
Deploy by uploading this folder (app.py, recommender.py, rag.py, data/) to a Gradio Space.
"""

import gradio as gr
from recommender import PlutusRecommender

# Load once at startup (tiny corpus → instant)
recommender = PlutusRecommender(mode="bm25")
ALL_TOPICS = recommender.list_topics()


def recommend_ui(query: str, k: int, tool: str, exclude_text: str):
    if not query.strip():
        return "Please enter what you want to learn."

    exclude_ids = [x.strip() for x in exclude_text.split(",") if x.strip()] if exclude_text else None
    results = recommender.recommend(query, k=int(k), tool=tool, exclude_ids=exclude_ids)

    if not results:
        return "No recommendations found. Try a different query."

    lines = [f"**Recommendations for:** _{query}_\n"]
    for i, r in enumerate(results, 1):
        topics = ", ".join(r["topics"][:4]) if r["topics"] else "—"
        lines.append(
            f"### {i}. {r['title']}  \n"
            f"**Score:** {r['score']}  |  **Tool:** `{r['tool']}`  |  **Topics:** {topics}  \n"
            f"[Open source]({r['url']})  \n"
            f"{r['snippet']}\n"
        )
    return "\n".join(lines)


def topic_recommend(selected_topics: list[str], k: int):
    if not selected_topics:
        return "Select at least one topic."
    results = recommender.recommend_by_topics(selected_topics, k=int(k))
    if not results:
        return "No recommendations."
    lines = [f"**Recommendations for topics:** {', '.join(selected_topics)}\n"]
    for i, r in enumerate(results, 1):
        lines.append(
            f"### {i}. {r['title']}  \n"
            f"**Score:** {r['score']}  |  [Source]({r['url']})  \n"
            f"{r['snippet']}\n"
        )
    return "\n".join(lines)


with gr.Blocks(title="Plutus Learning Recommender", theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        """
        # Plutus Learning Material Recommender
        Simple content-based recommendations over the Plutus Learner RAG corpus.
        Enter what you want to learn (or pick topics) and get ranked learning resources.

        **Runs entirely on CPU** — suitable for free Hugging Face Spaces.
        """
    )

    with gr.Tab("Query Recommendation"):
        query_in = gr.Textbox(
            label="What do you want to learn?",
            placeholder="e.g. difference between datum and redeemer, Plutus V3 validators, collateral...",
            lines=2,
        )
        with gr.Row():
            k_slider = gr.Slider(1, 10, value=5, step=1, label="Number of recommendations")
            tool_dd = gr.Dropdown(
                choices=["all", "plinth", "cardano"],
                value="all",
                label="Filter by tool",
            )
        exclude_in = gr.Textbox(
            label="Exclude chunk IDs (comma-separated, optional)",
            placeholder="leave empty",
        )
        rec_btn = gr.Button("Get Recommendations", variant="primary")
        output = gr.Markdown()

        rec_btn.click(
            recommend_ui,
            inputs=[query_in, k_slider, tool_dd, exclude_in],
            outputs=output,
        )

    with gr.Tab("By Topic"):
        topic_choices = gr.CheckboxGroup(choices=ALL_TOPICS, label="Select topics")
        topic_k = gr.Slider(1, 10, value=5, step=1, label="Number of recommendations")
        topic_btn = gr.Button("Recommend from topics", variant="primary")
        topic_output = gr.Markdown()
        topic_btn.click(topic_recommend, inputs=[topic_choices, topic_k], outputs=topic_output)

    gr.Markdown(
        f"""
        ---
        **Corpus:** {recommender.manifest.get('chunk_count', '?')} chunks
        · Mode: BM25 (pure Python)
        · Source: Plutus Learner RAG bootstrap notes

        This is a lightweight content-based recommender. For denser semantic search,
        install `fastembed` and switch the mode to `"hybrid"` in the code.
        """
    )

if __name__ == "__main__":
    demo.launch()
