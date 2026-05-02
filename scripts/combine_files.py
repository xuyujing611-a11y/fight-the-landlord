#!/usr/bin/env python3
"""扫描斗地主项目下所有 .md 和 .js 文件，整合到一个 markdown 文件中。"""

import os
import sys

PROJECT_DIR = "/home/xu_yujing/openclaw/workspaces/fight-the-landlord"
OUTPUT_FILE = os.path.join(PROJECT_DIR, "docs", "ALL_FILES.md")

# 排除的目录和文件
EXCLUDE_DIRS = {"node_modules", ".git", "__pycache__", ".gitlab", "assets"}
EXCLUDE_FILES = {".gitignore", ".gitattributes", "package-lock.json", "yarn.lock"}

def collect_files(root):
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        # 跳过排除目录
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for f in filenames:
            if f in EXCLUDE_FILES:
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext in (".md", ".js"):
                files.append(os.path.join(dirpath, f))
    return sorted(files)

def main():
    files = collect_files(PROJECT_DIR)
    if not files:
        print("❌ 未找到任何 .md 或 .js 文件")
        sys.exit(1)

    output = []
    output.append("# 斗地主项目 — 全部文档与源码\n")
    output.append(f"> 自动生成 (2026-05-02) | 共 {len(files)} 文件\n")
    output.append("---\n")

    for fp in files:
        rel = os.path.relpath(fp, PROJECT_DIR)
        size = os.path.getsize(fp)
        try:
            with open(fp, "r", encoding="utf-8") as fh:
                content = fh.read()
        except Exception as e:
            content = f"[读取失败: {e}]"

        output.append(f"## `{rel}` ({size:,} 字节)\n")
        output.append("```" + ("javascript" if fp.endswith(".js") else "markdown"))
        output.append(content)
        output.append("```\n")
        output.append("---\n")

        sys.stdout.write(f"  ✔ {rel}\n")
        sys.stdout.flush()

    out = "\n".join(output)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        fh.write(out)

    print(f"\n✅ 已生成: {OUTPUT_FILE}")
    print(f"   覆盖 {len(files)} 个文件, {os.path.getsize(OUTPUT_FILE):,} 字节")

if __name__ == "__main__":
    main()
