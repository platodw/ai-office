#!/usr/bin/env python3
"""
Build the AI Office installer.

Two stages:
  1. PyInstaller bundles server/native_host.py into a standalone
     installer/dist/native_host.exe (no Python needed at runtime).
  2. If the Inno Setup compiler (ISCC.exe) is available, it compiles
     installer/aioffice.iss into installer/Output/aioffice-setup.exe.
     If not, the .exe is left for manual compilation.

Usage:
    python installer/build.py
    python installer/build.py --skip-iscc   # only build the .exe
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INSTALLER_DIR = ROOT / "installer"
SERVER_DIR = ROOT / "server"
NATIVE_HOST = SERVER_DIR / "native_host.py"
DIST_DIR = INSTALLER_DIR / "dist"
BUILD_DIR = INSTALLER_DIR / "build"
ISS_PATH = INSTALLER_DIR / "aioffice.iss"


def ensure_pyinstaller() -> None:
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])


def build_exe() -> Path:
    ensure_pyinstaller()
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)

    # core.py lives next to native_host.py; PyInstaller follows the import
    # automatically because we add server/ to the script path.
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "native_host",
        "--distpath", str(DIST_DIR),
        "--workpath", str(BUILD_DIR),
        "--specpath", str(BUILD_DIR),
        "--paths", str(SERVER_DIR),
        "--noconfirm",
        str(NATIVE_HOST),
    ]
    print(f"Building: {' '.join(cmd)}")
    subprocess.check_call(cmd)

    exe = DIST_DIR / ("native_host.exe" if os.name == "nt" else "native_host")
    if not exe.exists():
        sys.exit(f"PyInstaller didn't produce {exe}")
    print(f"Built: {exe} ({exe.stat().st_size / 1024 / 1024:.1f} MB)")
    return exe


def find_iscc() -> Path | None:
    """Find Inno Setup's command-line compiler if installed."""
    candidates = [
        Path(r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe"),
        Path(r"C:\Program Files\Inno Setup 6\ISCC.exe"),
        Path(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe")),
    ]
    on_path = shutil.which("ISCC")
    if on_path:
        candidates.insert(0, Path(on_path))
    return next((p for p in candidates if p.exists()), None)


def compile_iss() -> Path | None:
    iscc = find_iscc()
    if iscc is None:
        print()
        print("Inno Setup not found. Skipping installer compilation.")
        print("Install it from https://jrsoftware.org/isdl.php and re-run, or")
        print(f"compile manually: ISCC.exe \"{ISS_PATH}\"")
        return None
    print(f"Compiling with {iscc}")
    subprocess.check_call([str(iscc), str(ISS_PATH)])
    output = INSTALLER_DIR / "Output"
    setup = next(output.glob("aioffice-setup-*.exe"), None) if output.exists() else None
    if setup:
        print(f"Installer: {setup}")
    return setup


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--skip-iscc", action="store_true",
                   help="Build native_host.exe but skip Inno Setup compilation")
    args = p.parse_args()

    build_exe()
    if not args.skip_iscc:
        compile_iss()


if __name__ == "__main__":
    main()
