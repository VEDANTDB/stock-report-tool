# Stock Report Tool

Automatically generates a professional equity research report from screener.in data.

## What You Need
- A screener.in Excel export (.xlsx) — mandatory
- Annual Report PDF — optional
- Earnings Transcript PDF — optional

## Setup (one time only)
1. Install Python: https://python.org
2. Install Node.js: https://nodejs.org
3. Run these commands:
   pip install -r requirements.txt
   npm install

## How to Run
export ANTHROPIC_API_KEY="your-key-here"

python3 run_report.py \
  --xlsx  YourCompany.xlsx \
  --pdf1  AnnualReport.pdf \
  --pdf2  Transcript.pdf \
  --out   Report.docx
```

Click **"Commit changes"**

---

## Your repo is ready! 🎉

It should look like this:
```
stock-report-tool/
├── run_report.py
├── extract_data.py
├── ai_analysis.py
├── generate_report.js
├── requirements.txt
├── package.json
├── .gitignore
├── .env.example
└── README.md
```

---

## Next Time You Want to Use It on a New Computer

1. Go to your repo on GitHub
2. Click the green **"Code"** button → **"Download ZIP"**
3. Unzip it, then run:
```
   pip install -r requirements.txt
   npm install
