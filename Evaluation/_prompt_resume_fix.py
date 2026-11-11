# Replacement for Section 7: Prepare a new run or restore this run.
# Run Sections 1-6 first. This cell does not load model weights or generate answers.
# Reuse the original saved prompts; never regenerate them with today's date on resume.
manifest_path = run_dir / "run_metadata.json"
existing_metadata = read_json(manifest_path) if manifest_path.exists() else None

settings = {
    "models": MODELS,
    "dtype": "bfloat16",
    "base_mxfp4_dequantized": True,
    "attention_implementation": "eager",
    "system_prompt": SYSTEM_PROMPT,
    "reasoning_effort": REASONING_EFFORT,
    "seed": SEED,
    "max_input_tokens": MAX_INPUT_TOKENS,
    "max_total_tokens": MAX_TOTAL_TOKENS,
    "token_budget_policy": "full_prompt_plus_all_generated_tokens",
    "per_request_allowance": "min(max_new_tokens, max_total_tokens - prompt_tokens)",
    "generation_settings": {
        "max_new_tokens": MAX_NEW_TOKENS,
        "do_sample": False,
        "num_beams": 1,
        "repetition_penalty": 1.0,
        "use_cache": True,
        "eos_token_id": [200002, 199999, 200012],
        "pad_token_id": 199999,
    },
    "question_sha256": _json_hash(questions),
}

if existing_metadata:
    if existing_metadata.get("settings") != settings:
        raise ValueError(
            "Questions or generation settings differ from this saved run. "
            "Restore the original settings, or choose a NEW RUN_NAME for a new evaluation."
        )
    revisions = existing_metadata["revisions"]
else:
    if (any((run_dir / "records").glob("*/*.json"))
        or (run_dir / "comparison.json").exists()
        or (run_dir / "answers.jsonl").exists()):
        raise RuntimeError("Result files exist but run_metadata.json is missing. Restore it; do not overwrite this folder.")
    revisions = {tag: model_info(repo).sha for tag, repo in MODELS.items()}

tokenizer = AutoTokenizer.from_pretrained(MODELS["base"], revision=revisions["base"])
generation_config = GenerationConfig(**settings["generation_settings"])

# The GPT-OSS template inserts today's date. On resume, reuse the original
# saved prompt text AND token IDs instead of rendering a new dated prompt.
# The existing run fingerprint remains unchanged and is verified below.
import copy
from datetime import timedelta


def _build_prompt_records():
    records = []
    for item in questions:
        messages = make_messages(item)
        rendered = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True,
            reasoning_effort=REASONING_EFFORT,
        )
        encoded = tokenizer(rendered, add_special_tokens=False, return_tensors="pt")
        n, allowance = token_budget(encoded)
        records.append({
            "id": item["id"], "messages": messages, "rendered_prompt": rendered,
            "input_ids": encoded["input_ids"][0].tolist(),
            "prompt_tokens": n, "max_new_tokens_for_request": allowance,
            "max_total_tokens": MAX_TOTAL_TOKENS,
        })
    return records


def _fingerprint(records):
    return _json_hash({"settings": settings, "revisions": revisions, "prompts": records})


def _recover_missing_prompts():
    # Recovery is allowed ONLY when the complete reconstructed records match
    # the original saved SHA-256. Never create a new fingerprint for old answers.
    fresh = _build_prompt_records()
    expected = existing_metadata["run_sha256"]
    if _fingerprint(fresh) == expected:
        return fresh
    started = existing_metadata.get("started_utc", "")
    try:
        initial_date = datetime.fromisoformat(started.replace("Z", "+00:00")).date()
    except (ValueError, AttributeError):
        initial_date = None
    if initial_date is not None:
        # The template uses local time, while metadata stores UTC. Test adjacent
        # dates too; a candidate is accepted only with an exact original hash.
        for offset in (0, -1, 1):
            date = (initial_date + timedelta(days=offset)).isoformat()
            candidate = copy.deepcopy(fresh)
            for record in candidate:
                rendered, count = re.subn(
                    r"(?m)^Current date: [0-9]{4}-[0-9]{2}-[0-9]{2}$",
                    "Current date: " + date,
                    record["rendered_prompt"], count=1,
                )
                if count != 1:
                    break
                encoded = tokenizer(rendered, add_special_tokens=False, return_tensors="pt")
                n, allowance = token_budget(encoded)
                record.update({
                    "rendered_prompt": rendered,
                    "input_ids": encoded["input_ids"][0].tolist(),
                    "prompt_tokens": n,
                    "max_new_tokens_for_request": allowance,
                })
            else:
                if _fingerprint(candidate) == expected:
                    print("Recovered the exact original prompts; original fingerprint verified.")
                    return candidate
    raise RuntimeError(
        "prompts.json is missing and exact reconstruction could not be verified. "
        "No saved answers have been changed. Restore the original prompts.json "
        "from Drive/trash or a backup. Do not delete run_metadata.json or bypass this check."
    )


prompt_path = run_dir / "prompts.json"
prompts_need_saving = not prompt_path.exists()
if existing_metadata:
    prompt_records = read_json(prompt_path) if prompt_path.exists() else _recover_missing_prompts()
    if _fingerprint(prompt_records) != existing_metadata["run_sha256"]:
        raise ValueError(
            "Saved prompts do not match the ORIGINAL run fingerprint. Nothing was overwritten. "
            "Restore the matching prompts.json and run_metadata.json; do not reset saved answers."
        )
    print("Using the original saved prompts, including their original date and token IDs.")
else:
    prompt_records = _build_prompt_records()
    # An interrupted first preparation can leave a prompt file but no metadata.
    # Archive that file instead of silently overwriting it.
    prompts_need_saving = True

if not isinstance(prompt_records, list) or len(prompt_records) != len(questions):
    raise ValueError("The saved prompt count does not match the questions. No answers were changed.")

prepared = []
for item, record in zip(questions, prompt_records):
    if record.get("id") != item["id"] or record.get("messages") != make_messages(item):
        raise ValueError("Saved prompt does not match the question: " + item["id"])
    ids = record.get("input_ids")
    if not isinstance(ids, list) or not ids or any(type(i) is not int or i < 0 for i in ids):
        raise ValueError("Invalid saved token IDs: " + item["id"])
    # Verify that the pinned tokenizer still encodes the SAVED text identically.
    check = tokenizer(record["rendered_prompt"], add_special_tokens=False, return_tensors="pt")
    if check["input_ids"][0].tolist() != ids:
        raise ValueError(
            "Tokenizer no longer reproduces the saved text's token IDs for " + item["id"] +
            ". Restore the saved tokenizer revision and package versions; do not overwrite prompts."
        )
    input_ids = torch.tensor([ids], dtype=torch.long)
    encoded = {"input_ids": input_ids, "attention_mask": torch.ones_like(input_ids)}
    n, allowance = token_budget(encoded)
    if (record.get("prompt_tokens") != n
        or record.get("max_new_tokens_for_request") != allowance
        or record.get("max_total_tokens") != MAX_TOTAL_TOKENS):
        raise ValueError("Saved token budget does not match this run: " + item["id"])
    prepared.append(encoded)
    print(f"{item['id']}: {n} saved prompt + up to {allowance} generated "
          f"= {MAX_TOTAL_TOKENS} total tokens (same for both models)")

current_versions = {p: importlib.metadata.version(p)
                    for p in ("torch", "transformers", "accelerate", "safetensors", "huggingface_hub", "psutil")}
run_hash = _json_hash({"settings": settings, "revisions": revisions, "prompts": prompt_records})
if existing_metadata:
    metadata = existing_metadata
    if metadata["run_sha256"] != run_hash:
        raise ValueError("Run fingerprint mismatch; refusing to mix saved results.")
    # Restore the saved GenerationConfig rather than new library defaults.
    generation_config = GenerationConfig.from_dict(metadata["generation_config"])
    for package in ("transformers", "accelerate", "safetensors", "huggingface_hub"):
        if metadata["versions"].get(package) != current_versions[package]:
            raise RuntimeError(f"{package} differs from the saved run. Rerun the install cell, restart, and resume.")
else:
    metadata = {
        "schema_version": 1,
        "run_sha256": run_hash,
        "started_utc": _utc_now(),
        "settings": settings,
        "models": MODELS,
        "revisions": revisions,
        "tokenizer_repository": MODELS["base"],
        "tokenizer_revision": revisions["base"],
        "generation_config": generation_config.to_dict(),
        "question_sha256": _json_hash(questions),
        "versions": current_versions,
        "python": sys.version,
        "completed_models": [],
        "method_note": "Checkpoint comparison, not an adapter-only ablation; Plutus has a different training/export history.",
        "budget_note": "2048 full-prompt plus all generated tokens. Counts analysis, final text and structural tokens; this is not a 2048-final-answer-token allowance.",
    }

metadata.setdefault("sessions", []).append({
    "utc": _utc_now(), "versions": current_versions,
    "python": sys.version, "gpu": torch.cuda.get_device_name(0),
})
if existing_metadata and metadata["versions"]["torch"] != current_versions["torch"]:
    print("WARNING: PyTorch differs from the first session. This is recorded; exact reproducibility may differ.")

# Restore every durable per-answer record; summaries can be recreated after a timeout.
results = restore_answers(questions, metadata)
if prompts_need_saving:
    if prompt_path.exists():
        backup_path = prompt_path.with_name("prompts.before_prepare." + uuid.uuid4().hex + ".json")
        write_text_checked(backup_path, prompt_path.read_text(encoding="utf-8"))
    write_json_checked(prompt_path, prompt_records)
save_results(run_dir, results, metadata)
for tag in MODELS:
    retained = sum(row[tag]["status"] not in ("not_run", "interrupted") for row in results)
    print(f"{tag}: {retained}/{len(questions)} recorded outcomes; {len(questions) - retained} remaining")
print("Drive folder:", run_dir)
print("Saved model revisions:", revisions)
