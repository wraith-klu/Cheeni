"""
Generates Google Colab / Kaggle Training Notebook for Capability 2:
Neural Wake Word Detection for 'Hey Cheeni' using wav2vec2 cross-lingual speech representations.
Uses torchaudio.datasets.SPEECHCOMMANDS directly (100% script-free, bypasses Hugging Face script deprecation).
"""

import json
from pathlib import Path

NOTEBOOK_PATH = Path("c:/BTech/AI Based Projects/Cheeni/notebooks/02_wakeword_xlsr.ipynb")

cells = [
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# 🎙️ Cheeni Capability 2: Neural Wake Word Detector\n",
            "### Fine-Tuning `facebook/wav2vec2-base` on 'Hey Cheeni' Wake Word\n",
            "\n",
            "**Architecture**: Cross-lingual wav2vec2 acoustic audio encoder + binary classification head  \n",
            "**Target Hugging Face Model**: `wraithklu/cheeni-wakeword-xlsr`  \n",
            "**Compute**: Google Colab (Tesla T4 GPU or A100)"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# 1. Install Audio Processing & Hugging Face Libraries\n",
            "!pip install -q transformers datasets evaluate accelerate torchaudio edge-tts soundfile huggingface_hub"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# 2. Authenticate with Hugging Face\n",
            "from huggingface_hub import login\n",
            "import os\n",
            "\n",
            "HF_TOKEN = os.getenv(\"HF_TOKEN\", \"YOUR_HF_TOKEN_HERE\")\n",
            "if HF_TOKEN != \"YOUR_HF_TOKEN_HERE\":\n",
            "    login(token=HF_TOKEN)\n",
            "else:\n",
            "    login()"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# 3. Synthesize 500+ Diverse 'Hey Cheeni' Positive Audio Samples\n",
            "import os\n",
            "import edge_tts\n",
            "import torchaudio\n",
            "import torch\n",
            "\n",
            "os.makedirs(\"data/positive\", exist_ok=True)\n",
            "os.makedirs(\"data/negative\", exist_ok=True)\n",
            "\n",
            "VOICES = [\n",
            "    \"en-IN-NeerjaNeural\", \"en-IN-PrabhatNeural\",  # Indian English\n",
            "    \"hi-IN-SwaraNeural\", \"hi-IN-MadhurNeural\",    # Hindi\n",
            "    \"en-US-JennyNeural\", \"en-US-GuyNeural\",       # American\n",
            "    \"en-GB-RyanNeural\", \"en-GB-SoniaNeural\"      # British\n",
            "]\n",
            "\n",
            "PHRASES = [\n",
            "    \"Hey Cheeni\", \"Cheeni\", \"OK Cheeni\", \"Sun Cheeni\",\n",
            "    \"Cheeni suno\", \"Hello Cheeni\", \"Hey Cheeni listen\"\n",
            "]\n",
            "\n",
            "PITCHES = [\"-10Hz\", \"+0Hz\", \"+15Hz\"]\n",
            "RATES = [\"-10%\", \"+0%\", \"+15%\"]\n",
            "\n",
            "print(\"🎙️ Generating 500+ diverse acoustic variations for 'Hey Cheeni'...\")\n",
            "\n",
            "async def generate_audio_samples():\n",
            "    count = 0\n",
            "    for phrase in PHRASES:\n",
            "        for voice in VOICES:\n",
            "            for pitch in PITCHES:\n",
            "                for rate in RATES:\n",
            "                    filename = f\"data/positive/cheeni_{count:04d}.mp3\"\n",
            "                    comm = edge_tts.Communicate(phrase, voice, pitch=pitch, rate=rate)\n",
            "                    await comm.save(filename)\n",
            "                    count += 1\n",
            "    return count\n",
            "\n",
            "total_samples = await generate_audio_samples()\n",
            "print(f\"✅ Generated {total_samples} positive wake word audio clips!\")"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# 4. Load Negative Audio Samples using PyTorch torchaudio (Zero Hugging Face Script Errors!)\n",
            "import torchaudio\n",
            "import soundfile as sf\n",
            "\n",
            "print(\"📥 Downloading Google Speech Commands v2 directly via PyTorch torchaudio...\")\n",
            "sc_dataset = torchaudio.datasets.SPEECHCOMMANDS(root=\"./data\", download=True, subset=\"training\")\n",
            "print(f\"Loaded Speech Commands: {len(sc_dataset)} total clips available.\")\n",
            "\n",
            "neg_count = 0\n",
            "for i in range(len(sc_dataset)):\n",
            "    waveform, sample_rate, label, speaker_id, utterance_num = sc_dataset[i]\n",
            "    if label in [\"yes\", \"no\", \"up\", \"down\", \"left\", \"right\", \"stop\", \"go\", \"zero\", \"one\", \"two\", \"three\"]:\n",
            "        audio_data = waveform.squeeze().numpy()\n",
            "        sf.write(f\"data/negative/neg_{neg_count:04d}.wav\", audio_data, sample_rate)\n",
            "        neg_count += 1\n",
            "        if neg_count >= 1000:\n",
            "            break\n",
            "\n",
            "print(f\"✅ Successfully saved {neg_count} negative audio samples directly into data/negative/!\")"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# 5. Convert & Preprocess all Audio to 16kHz PCM Mono\n",
            "import glob\n",
            "import numpy as np\n",
            "import torchaudio\n",
            "import torch\n",
            "\n",
            "TARGET_SAMPLE_RATE = 16000\n",
            "MAX_DURATION_SECONDS = 2.0  # 2-second max window for wake word detection\n",
            "MAX_SAMPLES = int(TARGET_SAMPLE_RATE * MAX_DURATION_SECONDS)\n",
            "\n",
            "data_records = []\n",
            "\n",
            "# Positive clips (Label: 1)\n",
            "for f in glob.glob(\"data/positive/*.mp3\"):\n",
            "    try:\n",
            "        waveform, sr = torchaudio.load(f)\n",
            "        if waveform.shape[0] > 1:\n",
            "            waveform = torch.mean(waveform, dim=0, keepdim=True)\n",
            "        if sr != TARGET_SAMPLE_RATE:\n",
            "            waveform = torchaudio.functional.resample(waveform, sr, TARGET_SAMPLE_RATE)\n",
            "        arr = waveform.squeeze().numpy()\n",
            "        if len(arr) < MAX_SAMPLES:\n",
            "            arr = np.pad(arr, (0, MAX_SAMPLES - len(arr)))\n",
            "        else:\n",
            "            arr = arr[:MAX_SAMPLES]\n",
            "        data_records.append({\"audio\": arr, \"label\": 1})\n",
            "    except Exception:\n",
            "        pass\n",
            "\n",
            "# Negative clips (Label: 0)\n",
            "for f in glob.glob(\"data/negative/*.wav\"):\n",
            "    try:\n",
            "        waveform, sr = torchaudio.load(f)\n",
            "        if waveform.shape[0] > 1:\n",
            "            waveform = torch.mean(waveform, dim=0, keepdim=True)\n",
            "        if sr != TARGET_SAMPLE_RATE:\n",
            "            waveform = torchaudio.functional.resample(waveform, sr, TARGET_SAMPLE_RATE)\n",
            "        arr = waveform.squeeze().numpy()\n",
            "        if len(arr) < MAX_SAMPLES:\n",
            "            arr = np.pad(arr, (0, MAX_SAMPLES - len(arr)))\n",
            "        else:\n",
            "            arr = arr[:MAX_SAMPLES]\n",
            "        data_records.append({\"audio\": arr, \"label\": 0})\n",
            "    except Exception:\n",
            "        pass\n",
            "\n",
            "print(f\"✅ Total processed dataset: {len(data_records)} audio records (Positives: 1, Negatives: 0)\")"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# 6. Feature Extraction with wav2vec2 Feature Extractor\n",
            "from transformers import AutoFeatureExtractor\n",
            "from sklearn.model_selection import train_test_split\n",
            "from datasets import Dataset\n",
            "\n",
            "MODEL_NAME = \"facebook/wav2vec2-base\"\n",
            "feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME)\n",
            "\n",
            "train_recs, eval_recs = train_test_split(data_records, test_size=0.15, random_state=42, stratify=[r['label'] for r in data_records])\n",
            "\n",
            "def prepare_dataset(records):\n",
            "    audio_arrays = [r[\"audio\"] for r in records]\n",
            "    labels = [r[\"label\"] for r in records]\n",
            "    inputs = feature_extractor(audio_arrays, sampling_rate=TARGET_SAMPLE_RATE, padding=True, return_tensors=\"pt\")\n",
            "    return Dataset.from_dict({\"input_values\": inputs[\"input_values\"], \"labels\": labels})\n",
            "\n",
            "train_dataset = prepare_dataset(train_recs)\n",
            "eval_dataset = prepare_dataset(eval_recs)\n",
            "print(f\"Train samples: {len(train_dataset)}, Eval samples: {len(eval_dataset)}\")"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# 7. Initialize wav2vec2 For Sequence Classification & Metrics\n",
            "from transformers import AutoModelForSequenceClassification, TrainingArguments, Trainer\n",
            "import evaluate\n",
            "import numpy as np\n",
            "import torch\n",
            "\n",
            "model = AutoModelForSequenceClassification.from_pretrained(\n",
            "    MODEL_NAME,\n",
            "    num_labels=2,\n",
            "    id2label={0: \"negative\", 1: \"wake_word\"},\n",
            "    label2id={\"negative\": 0, \"wake_word\": 1}\n",
            ")\n",
            "\n",
            "# Freeze feature encoder to preserve pre-trained acoustic representations and train fast\n",
            "model.freeze_feature_encoder()\n",
            "\n",
            "accuracy_metric = evaluate.load(\"accuracy\")\n",
            "f1_metric = evaluate.load(\"f1\")\n",
            "\n",
            "def compute_metrics(eval_pred):\n",
            "    logits, labels = eval_pred\n",
            "    preds = np.argmax(logits, axis=1)\n",
            "    acc = accuracy_metric.compute(predictions=preds, references=labels)[\"accuracy\"]\n",
            "    f1 = f1_metric.compute(predictions=preds, references=labels)[\"f1\"]\n",
            "    return {\"accuracy\": acc, \"f1\": f1}\n",
            "\n",
            "training_args = TrainingArguments(\n",
            "    output_dir=\"./cheeni-wakeword-checkpoints\",\n",
            "    eval_strategy=\"epoch\",\n",
            "    save_strategy=\"epoch\",\n",
            "    learning_rate=3e-5,\n",
            "    per_device_train_batch_size=16,\n",
            "    per_device_eval_batch_size=32,\n",
            "    num_train_epochs=4,\n",
            "    weight_decay=0.01,\n",
            "    fp16=torch.cuda.is_available(),\n",
            "    load_best_model_at_end=True,\n",
            "    metric_for_best_model=\"f1\",\n",
            "    report_to=\"none\"\n",
            ")\n",
            "\n",
            "trainer = Trainer(\n",
            "    model=model,\n",
            "    args=training_args,\n",
            "    train_dataset=train_dataset,\n",
            "    eval_dataset=eval_dataset,\n",
            "    compute_metrics=compute_metrics,\n",
            ")\n",
            "\n",
            "print(\"🚀 Training Neural Wake Word Model on GPU...\")\n",
            "trainer.train()"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# 8. Test Live Wake Word Inference on Validation Audio\n",
            "model.eval()\n",
            "test_sample = eval_dataset[0][\"input_values\"]\n",
            "test_input = torch.tensor([test_sample]).float()\n",
            "\n",
            "with torch.no_grad():\n",
            "    logits = model(test_input).logits\n",
            "    probs = torch.softmax(logits, dim=-1)[0]\n",
            "    pred_class = torch.argmax(probs).item()\n",
            "    label_name = \"wake_word\" if pred_class == 1 else \"negative\"\n",
            "    confidence = probs[pred_class].item()\n",
            "\n",
            "print(f\"Audio Sample Prediction: {label_name} (Confidence: {confidence:.2%})\")\n",
            "print(f\"True Ground Truth Label: {'wake_word' if eval_dataset[0]['labels'] == 1 else 'negative'}\")"
        ]
    },
    {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [
            "# 9. Push Directly to Hugging Face Hub (wraithklu/cheeni-wakeword-xlsr)\n",
            "HF_REPO_ID = \"wraithklu/cheeni-wakeword-xlsr\"\n",
            "\n",
            "print(f\"Pushing trained wake word model to https://huggingface.co/{HF_REPO_ID}...\")\n",
            "model.push_to_hub(HF_REPO_ID)\n",
            "feature_extractor.push_to_hub(HF_REPO_ID)\n",
            "print(f\"🎉 SUCCESS! Wake Word Model is live: https://huggingface.co/{HF_REPO_ID}\")"
        ]
    }
]

notebook = {
    "cells": cells,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "name": "python",
            "version": "3.10.0"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 2
}

with open(NOTEBOOK_PATH, "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=2)

print(f"✅ Generated updated Capability 2 notebook at: {NOTEBOOK_PATH}")
