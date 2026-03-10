#!/usr/bin/env python3
"""
run_report.py  —  ONE-COMMAND STOCK REPORT GENERATOR
══════════════════════════════════════════════════════

Usage:
    python3 run_report.py \
        --xlsx  path/to/Company_screener.xlsx \
        [--pdf1 path/to/AnnualReport.pdf] \
        [--pdf2 path/to/EarningsTranscript_or_Presentation.pdf] \
        [--out  My_Company_Report.docx]

Requirements:
    • Python 3.8+  (standard lib only for core; openpyxl for Excel)
    • Node.js 16+  with docx installed:  npm install -g docx
    • (Optional) ANTHROPIC_API_KEY env var for AI-generated analysis
      If not set, a rule-based fallback analysis is used automatically.

Files expected (all are the same format used in this session):
    --xlsx   screener.in "Export to Excel" download  (mandatory)
    --pdf1   Company Annual Report PDF                (optional, improves AI analysis)
    --pdf2   Earnings Call Transcript / Investor PPT  (optional, improves AI analysis)

Example:
    export ANTHROPIC_API_KEY="sk-ant-..."

    python3 run_report.py \\
        --xlsx  Waaree_Energies.xlsx \\
        --pdf1  Waree_FY_2025_Report.pdf \\
        --pdf2  Waree_Trascript_Feb_2026.pdf \\
        --out   Waaree_Investment_Report.docx
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def run(cmd, **kwargs):
    print(f"\n>>> {' '.join(cmd)}")
    result = subprocess.run(cmd, **kwargs)
    if result.returncode != 0:
        print(f"❌ Step failed (exit {result.returncode})", file=sys.stderr)
        sys.exit(result.returncode)
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Generate a professional equity research report from screener.in data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("--xlsx",  required=True, help="screener.in Excel export (.xlsx)")
    parser.add_argument("--pdf1",  default="",    help="Annual Report PDF (optional)")
    parser.add_argument("--pdf2",  default="",    help="Earnings Transcript / Investor PPT PDF (optional)")
    parser.add_argument("--out",   default="",    help="Output .docx path (default: <CompanyName>_Investment_Report.docx)")
    args = parser.parse_args()

    # Validate inputs
    if not os.path.exists(args.xlsx):
        print(f"❌ Excel file not found: {args.xlsx}", file=sys.stderr)
        sys.exit(1)

    # Temp working directory
    tmpdir = tempfile.mkdtemp(prefix="stock_report_")
    print(f"\n📁 Working directory: {tmpdir}")

    data_json = os.path.join(tmpdir, "extracted_data.json")
    ai_json   = os.path.join(tmpdir, "ai_analysis.json")

    # ── Step 1: Extract data from Excel (+ PDFs) ──────────────────────────────
    print("\n" + "═"*55)
    print("STEP 1/3 — Extracting financial data from Excel & PDFs")
    print("═"*55)
    cmd1 = [sys.executable, os.path.join(SCRIPT_DIR, "extract_data.py"),
            "--xlsx", args.xlsx,
            "--out",  data_json]
    if args.pdf1: cmd1 += ["--pdf1", args.pdf1]
    if args.pdf2: cmd1 += ["--pdf2", args.pdf2]
    run(cmd1)

    # Read company name for default output filename
    with open(data_json) as f:
        extracted = json.load(f)
    company_name = extracted["meta"]["company_name"].replace(" ", "_").replace("/", "-")
    out_file = args.out or f"{company_name}_Investment_Report.docx"

    # ── Step 2: AI analysis ────────────────────────────────────────────────────
    print("\n" + "═"*55)
    print("STEP 2/3 — Generating investment analysis")
    print("═"*55)
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if api_key:
        print(f"✅ ANTHROPIC_API_KEY found — using Claude AI analysis")
    else:
        print("⚠️  No ANTHROPIC_API_KEY — using rule-based fallback analysis")
        print("   (Set ANTHROPIC_API_KEY env var to enable AI-powered analysis)")

    cmd2 = [sys.executable, os.path.join(SCRIPT_DIR, "ai_analysis.py"),
            "--data", data_json,
            "--out",  ai_json]
    run(cmd2)

    # ── Step 3: Generate Word document ────────────────────────────────────────
    print("\n" + "═"*55)
    print("STEP 3/3 — Building Word document")
    print("═"*55)
    cmd3 = ["node", os.path.join(SCRIPT_DIR, "generate_report.js"),
            "--data", data_json,
            "--ai",   ai_json,
            "--out",  out_file]
    run(cmd3)

    # Cleanup
    shutil.rmtree(tmpdir, ignore_errors=True)

    print("\n" + "🎉"*25)
    print(f"\n✅  SUCCESS!  Report saved to:  {out_file}")
    print(f"    Company : {extracted['meta']['company_name']}")
    print(f"    CMP     : ₹{extracted['meta']['cmp']}")
    print(f"    Mkt Cap : ₹{extracted['meta']['mkt_cap_cr']} Cr")
    print("\n" + "🎉"*25)


if __name__ == "__main__":
    main()
