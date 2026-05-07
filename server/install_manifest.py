#!/usr/bin/env python3
"""
Register the AI Office Native Messaging host with Chrome.

Usage:
    python server/install_manifest.py --extension-id <ID>
    python server/install_manifest.py --uninstall

The extension ID is shown on chrome://extensions when Developer mode is on.
For a published extension this will eventually default to the Web Store ID.
"""

import argparse
import json
import os
import platform
import shutil
import stat
import sys
from pathlib import Path

HOST_NAME = "com.aioffice.companion"
SERVER_DIR = Path(__file__).resolve().parent
NATIVE_HOST_PY = SERVER_DIR / "native_host.py"


def chrome_manifest_dir() -> Path:
    """Where Chrome looks for Native Messaging manifests on this OS."""
    system = platform.system()
    home = Path.home()
    if system == "Windows":
        # Windows uses the registry, but we still need somewhere to keep the
        # manifest file itself. Co-locate it with the host script.
        return SERVER_DIR / "manifests"
    if system == "Darwin":
        return home / "Library/Application Support/Google/Chrome/NativeMessagingHosts"
    return home / ".config/google-chrome/NativeMessagingHosts"


def write_wrapper() -> Path:
    """Write a small launcher that runs native_host.py with the right Python.

    Chrome needs an executable to spawn; pointing it directly at a .py file
    isn't reliable across platforms.
    """
    python = sys.executable
    if platform.system() == "Windows":
        wrapper = SERVER_DIR / "native_host.bat"
        wrapper.write_text(
            "@echo off\r\n"
            f'"{python}" "{NATIVE_HOST_PY}" %*\r\n',
            encoding="utf-8",
        )
    else:
        wrapper = SERVER_DIR / "native_host.sh"
        wrapper.write_text(
            "#!/usr/bin/env bash\n"
            f'exec "{python}" "{NATIVE_HOST_PY}" "$@"\n',
            encoding="utf-8",
        )
        wrapper.chmod(wrapper.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return wrapper


def write_manifest(extension_id: str, wrapper: Path) -> Path:
    manifest = {
        "name": HOST_NAME,
        "description": "AI Office companion for Claude Desktop",
        "path": str(wrapper),
        "type": "stdio",
        "allowed_origins": [f"chrome-extension://{extension_id}/"],
    }
    target_dir = chrome_manifest_dir()
    target_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = target_dir / f"{HOST_NAME}.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path


def register_windows_registry(manifest_path: Path) -> None:
    import winreg
    key_path = rf"Software\Google\Chrome\NativeMessagingHosts\{HOST_NAME}"
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(manifest_path))


def unregister_windows_registry() -> None:
    import winreg
    key_path = rf"Software\Google\Chrome\NativeMessagingHosts\{HOST_NAME}"
    try:
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER, key_path)
    except FileNotFoundError:
        pass


def install(extension_id: str) -> None:
    if not NATIVE_HOST_PY.exists():
        sys.exit(f"native_host.py not found at {NATIVE_HOST_PY}")
    wrapper = write_wrapper()
    manifest_path = write_manifest(extension_id, wrapper)
    if platform.system() == "Windows":
        register_windows_registry(manifest_path)
    print(f"Installed Native Messaging host for extension {extension_id}")
    print(f"  Manifest: {manifest_path}")
    print(f"  Wrapper:  {wrapper}")
    print(f"  Python:   {sys.executable}")
    print()
    print("Reload the extension at chrome://extensions for it to pick this up.")


def uninstall() -> None:
    target = chrome_manifest_dir() / f"{HOST_NAME}.json"
    if target.exists():
        target.unlink()
        print(f"Removed manifest: {target}")
    if platform.system() == "Windows":
        unregister_windows_registry()
        print("Removed registry entry")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--extension-id", help="The unpacked extension's ID from chrome://extensions")
    p.add_argument("--uninstall", action="store_true")
    args = p.parse_args()

    if args.uninstall:
        uninstall()
        return
    if not args.extension_id:
        sys.exit("--extension-id is required (find it on chrome://extensions)")
    install(args.extension_id)


if __name__ == "__main__":
    main()
