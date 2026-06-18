import argparse
import shutil
import subprocess
from pathlib import Path


def find_soffice():
    package_root = Path(__file__).resolve().parents[3]
    local = package_root / "LibreOffice相关" / "LibreOffice" / "program" / "soffice.exe"
    if local.exists():
        return local
    found = shutil.which("soffice") or shutil.which("libreoffice")
    return Path(found) if found else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("docx")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    docx = Path(args.docx)
    out = Path(args.out) if args.out else docx.parent / "抽样渲染"
    out.mkdir(parents=True, exist_ok=True)

    soffice = find_soffice()
    if not soffice:
        raise SystemExit("未找到 LibreOffice/soffice，无法抽样渲染。")

    subprocess.run(
        [
            str(soffice),
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(out),
            str(docx),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    print(out / (docx.stem + ".pdf"))


if __name__ == "__main__":
    main()
