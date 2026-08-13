# AI Pipeline & Model Specifications - SmartPrior-AI

## Pipeline Architecture

1. **OCR Layer:** Tesseract / AWS Textract / Cloud Vision for multi-page document layout parsing.
2. **Entity Recognition & Extraction:** Named Entity Recognition (NER) and Large Vision-Language Models (VLM) for extracting medical billing & clinical data.
3. **Policy Engine & Rules Evaluator:** Rule-based and embedding-based similarity search against insurance policy guidelines.

## AI Safeguards & Quality Control

- **Confidence Scoring Threshold:** Any extraction with confidence < 85% is flagged for manual review.
- **Hallucination Prevention:** Grounded prompt techniques requiring exact source page and paragraph citations for every claim recommendation.
- **Human-in-the-Loop:** All automated recommendations must be reviewable and overridable by licensed medical auditors.
