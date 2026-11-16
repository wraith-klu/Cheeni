"""
Universal HuggingFace Hub Upload Script
Uploads fine-tuned models, tokenizers, or ONNX artifacts to HuggingFace under wraith-klu/cheeni-*
"""

import os
import argparse
from huggingface_hub import HfApi, create_repo

def upload_model(local_dir: str, repo_id: str, private: bool = False):
    token = os.getenv("HF_TOKEN")
    if not token:
        raise ValueError("HF_TOKEN environment variable is missing. Set it with: export HF_TOKEN=hf_...")

    api = HfApi(token=token)
    
    print(f"📦 Ensuring repo exists: {repo_id}")
    create_repo(repo_id=repo_id, token=token, private=private, exist_ok=True)
    
    print(f"🚀 Uploading contents of '{local_dir}' to '{repo_id}'...")
    api.upload_folder(
        folder_path=local_dir,
        repo_id=repo_id,
        commit_message=f"Upload model from {local_dir}"
    )
    print(f"✅ Successfully uploaded to: https://huggingface.co/{repo_id}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload trained model to HuggingFace Hub")
    parser.add_argument("--dir", required=True, help="Local directory containing model files")
    parser.add_argument("--repo", required=True, help="HuggingFace repo ID (e.g., wraith-klu/cheeni-intent-deberta)")
    parser.add_argument("--private", action="store_true", help="Make repository private")
    
    args = parser.parse_args()
    upload_model(args.dir, args.repo, args.private)
