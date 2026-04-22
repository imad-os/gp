#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys


ROOT = pathlib.Path(__file__).resolve().parent
MAIN_JS = ROOT / "app" / "main.js"
SW_JS = ROOT / "sw.js"
VERSIONS_JSON = ROOT / "versions.json"


def run(cmd):
    print(f"\n$ {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Command not found: {cmd[0]}") from exc


def find_executable(candidates):
    for name in candidates:
        if shutil.which(name):
            return name
    return None


def find_windows_node_tool(tool_name):
    if os.name != "nt":
        return None
    candidates = [
        pathlib.Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs" / f"{tool_name}.cmd",
        pathlib.Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "nodejs" / f"{tool_name}.cmd",
        pathlib.Path.home() / "AppData" / "Roaming" / "npm" / f"{tool_name}.cmd",
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    return None


def resolve_firebase_deploy_commands():
    commands = []

    if os.name == "nt":
        # Try same style as manual terminal usage.
        commands.append(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                "firebase deploy",
            ]
        )

    npx_bin = find_executable(["npx", "npx.cmd", "npx.exe"])
    if not npx_bin:
        npx_bin = find_windows_node_tool("npx")
    if npx_bin:
        commands.append([npx_bin, "firebase-tools", "deploy"])

    npm_bin = find_executable(["npm", "npm.cmd", "npm.exe"])
    if not npm_bin:
        npm_bin = find_windows_node_tool("npm")
    if npm_bin:
        commands.append([npm_bin, "exec", "firebase-tools", "deploy"])

    firebase_bin = find_executable(["firebase.cmd", "firebase.exe", "firebase"])
    if firebase_bin:
        commands.append([firebase_bin, "deploy"])

    return commands


def read_text(path):
    return path.read_text(encoding="utf-8")


def write_text(path, content):
    path.write_text(content, encoding="utf-8")


def parse_version_parts(version):
    clean = version.strip().lstrip("vV")
    parts = [int(p) for p in re.split(r"[^0-9]+", clean) if p]
    if not parts:
        raise ValueError(f"Invalid version: {version}")
    return parts


def bump_version(version):
    parts = parse_version_parts(version)
    if len(parts) < 4:
        parts = parts + [0] * (4 - len(parts))
    parts[-1] += 1
    return f"v{parts[0]:04d}.{parts[1]:02d}.{parts[2]:02d}.{parts[3]}"


def extract_app_version(main_js_text):
    m = re.search(r"version:\s*'([^']+)'", main_js_text)
    if not m:
        raise RuntimeError("Could not find APP_BUILD.version in app/main.js")
    return m.group(1)


def update_app_version(main_js_text, new_version):
    return re.sub(r"(version:\s*')[^']+(')", rf"\g<1>{new_version}\2", main_js_text, count=1)


def update_sw_version_line(sw_js_text, new_version):
    sw_version = new_version.lstrip("vV")
    if "const SW_VERSION = " not in sw_js_text:
        raise RuntimeError("Could not find SW_VERSION in sw.js")
    return re.sub(r"(const SW_VERSION = ')[^']+(';)", rf"\g<1>{sw_version}\2", sw_js_text, count=1)


def update_versions_manifest(new_version, summary, description, changes):
    now = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    if VERSIONS_JSON.exists():
        data = json.loads(read_text(VERSIONS_JSON))
    else:
        data = {"latestVersion": new_version, "updates": []}

    updates = data.get("updates", [])
    updates = [u for u in updates if str(u.get("version", "")).strip() != new_version]
    updates.insert(
        0,
        {
            "version": new_version,
            "releasedAt": now,
            "summary": summary.strip(),
            "description": description.strip(),
            "changes": [c.strip() for c in changes if c.strip()],
        },
    )

    data["latestVersion"] = new_version
    data["updates"] = updates
    write_text(VERSIONS_JSON, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Bump version, commit, push, and deploy.")
    parser.add_argument("--summary", help="Release summary line.")
    parser.add_argument("--description", default="", help="Release description.")
    parser.add_argument(
        "--changes",
        default="",
        help="Semicolon-separated list of changes (example: 'A;B;C').",
    )
    parser.add_argument("--version", help="Explicit version (example: v2026.04.22.5).")
    parser.add_argument("--dry-run", action="store_true", help="Prepare files without git/deploy commands.")
    args = parser.parse_args()

    summary = (args.summary or "").strip() or "bug fixes ..."
    description = (args.description or "").strip()
    changes_raw = (args.changes or "").strip()
    changes = [c.strip() for c in changes_raw.split(";") if c.strip()]
    firebase_deploy_cmds = resolve_firebase_deploy_commands()

    main_js_text = read_text(MAIN_JS)
    current_version = extract_app_version(main_js_text)
    new_version = args.version.strip() if args.version else bump_version(current_version)

    print(f"Current version: {current_version}")
    print(f"Next version:    {new_version}")

    write_text(MAIN_JS, update_app_version(main_js_text, new_version))
    sw_text = read_text(SW_JS)
    write_text(SW_JS, update_sw_version_line(sw_text, new_version))
    update_versions_manifest(new_version, summary, description, changes)

    commit_msg = f"Release {new_version}: {summary}"
    if args.dry_run:
        print("\nDry run complete. Files updated locally, no git/firebase commands were run.")
        return 0
    if not firebase_deploy_cmds:
        print(
            "\nCould not find Firebase CLI.\n"
            "Install it with `npm i -g firebase-tools` or ensure `npx` is available in PATH."
        )
        return 1

    run(["git", "add", "-A"])
    run(["git", "commit", "-m", commit_msg])
    run(["git", "push"])
    deploy_ran = False
    for cmd in firebase_deploy_cmds:
        try:
            run(cmd)
            deploy_ran = True
            break
        except RuntimeError as exc:
            print(f"Skipping unavailable command: {exc}")
    if not deploy_ran:
        print("\nCould not execute Firebase deploy command.")
        return 1
    print("\nDeploy complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"\nCommand failed with exit code {exc.returncode}.")
        raise SystemExit(exc.returncode)
    except RuntimeError as exc:
        print(f"\n{exc}")
        raise SystemExit(1)
