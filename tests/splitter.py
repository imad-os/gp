#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NEURAL STEM — AI-powered audio stem separator
Futuristic dark GUI · Demucs-powered separation · Waveform visualization
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import tkinter.font as tkfont
import threading
import subprocess
import os
import sys
import json
import math
import time
import struct
import wave
import tempfile
import shutil
from pathlib import Path
import numpy as np

# ─── Try pygame for audio playback ───
try:
    import pygame
    pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=2048)
    PYGAME_OK = True
except Exception:
    PYGAME_OK = False

# ─── Color Palette ───
C = {
    "bg":        "#080c14",
    "bg2":       "#0d1520",
    "bg3":       "#111d2e",
    "panel":     "#0a1422",
    "border":    "#1a3050",
    "border2":   "#0e2840",
    "cyan":      "#00d4ff",
    "cyan_dim":  "#0088aa",
    "cyan_glow": "#00ffff",
    "green":     "#00ff88",
    "green_dim": "#007744",
    "orange":    "#ff6b35",
    "purple":    "#a855f7",
    "pink":      "#ff3399",
    "yellow":    "#ffd700",
    "text":      "#c8e4f8",
    "text_dim":  "#4a7090",
    "text_muted":"#2a4560",
    "white":     "#e8f4ff",
}

STEM_META = {
    "vocals":  {"color": C["cyan"],   "icon": "◈", "label": "VOCALS",  "desc": "Lead & backing vocals"},
    "drums":   {"color": C["orange"], "icon": "◉", "label": "DRUMS",   "desc": "Kick, snare, cymbals"},
    "bass":    {"color": C["green"],  "icon": "◆", "label": "BASS",    "desc": "Bass guitar & sub"},
    "guitar":  {"color": C["purple"], "icon": "◇", "label": "GUITAR",  "desc": "Electric & acoustic"},
    "piano":   {"color": C["yellow"], "icon": "◈", "label": "PIANO",   "desc": "Keys & piano"},
    "other":   {"color": C["pink"],   "icon": "◎", "label": "OTHER",   "desc": "Remaining instruments"},
}

MODELS = {
    "htdemucs_6s": "HT-Demucs 6-Stem  (vocals · drums · bass · guitar · piano · other)  ★ Best",
    "htdemucs":    "HT-Demucs 4-Stem  (vocals · drums · bass · other)  — Faster",
    "mdx_extra":   "MDX-Net Extra      (vocals · drums · bass · other)  — High Quality",
    "mdx":         "MDX-Net Standard   (vocals · drums · bass · other)  — Balanced",
}


def blend_hex(c1, c2, t):
    """Blend two #RRGGBB colors; t in [0, 1]. Returns Tk-safe #RRGGBB."""
    t = max(0.0, min(1.0, float(t)))
    c1 = c1.lstrip("#")
    c2 = c2.lstrip("#")
    r1, g1, b1 = int(c1[0:2], 16), int(c1[2:4], 16), int(c1[4:6], 16)
    r2, g2, b2 = int(c2[0:2], 16), int(c2[2:4], 16), int(c2[4:6], 16)
    r = int(r1 + (r2 - r1) * t)
    g = int(g1 + (g2 - g1) * t)
    b = int(b1 + (b2 - b1) * t)
    return f"#{r:02x}{g:02x}{b:02x}"


def read_wav_samples(path, max_samples=8000):
    """Read WAV file and return normalized float samples for waveform display."""
    try:
        with wave.open(path, 'rb') as wf:
            nch = wf.getnchannels()
            sw  = wf.getsampwidth()
            nfr = wf.getnframes()
            raw = wf.readframes(nfr)
        fmt = {1: 'b', 2: '<h', 4: '<i'}[sw]
        samples = np.frombuffer(raw, dtype=np.dtype(fmt)).astype(np.float32)
        if nch > 1:
            samples = samples[::nch]  # take left channel
        # Normalize
        mx = np.max(np.abs(samples)) or 1
        samples = samples / mx
        # Downsample for display
        if len(samples) > max_samples:
            step = len(samples) // max_samples
            samples = samples[::step][:max_samples]
        return samples
    except Exception:
        return np.zeros(100)


class WaveformCanvas(tk.Canvas):
    """Animated waveform display widget."""

    def __init__(self, parent, color, **kwargs):
        super().__init__(parent, bg=C["bg2"], highlightthickness=0, **kwargs)
        self.color = color
        self.samples = None
        self.anim_phase = 0
        self.is_playing = False
        self.play_pos = 0.0
        self._anim_id = None
        self.bind("<Configure>", self._on_resize)

    def set_samples(self, samples):
        self.samples = samples
        self._draw()

    def set_playing(self, playing, pos=0.0):
        self.is_playing = playing
        self.play_pos = pos
        if playing and self._anim_id is None:
            self._animate()
        elif not playing:
            if self._anim_id:
                self.after_cancel(self._anim_id)
                self._anim_id = None
            self._draw()

    def _on_resize(self, e=None):
        self._draw()

    def _animate(self):
        self.anim_phase += 0.05
        self._draw()
        self._anim_id = self.after(50, self._animate)

    def _draw(self):
        try:
            self.delete("all")
        except tk.TclError:
            return
        w = self.winfo_width()
        h = self.winfo_height()
        if w < 2 or h < 2:
            return

        mid = h / 2

        # Background grid lines
        for i in range(1, 4):
            y = h * i / 4
            self.create_line(0, y, w, y, fill=C["bg3"], width=1)

        if self.samples is None or len(self.samples) == 0:
            # Idle flat line with subtle pulse
            pulse = math.sin(self.anim_phase) * 2
            self.create_line(0, mid + pulse, w, mid + pulse,
                             fill=blend_hex(self.color, C["bg2"], 0.75), width=1, smooth=True)
            self.create_text(w//2, mid, text="NO SIGNAL",
                             fill=C["text_muted"], font=("Courier", 7))
            return

        # Draw waveform
        pts = []
        n = len(self.samples)
        for i, s in enumerate(self.samples):
            x = int(i * w / n)
            y = mid - s * (mid - 4)
            pts.extend([x, y])

        if len(pts) >= 4:
            # Glow effect (wider, dimmer line)
            glow_color = blend_hex(self.color, C["bg2"], 0.7)
            self.create_line(*pts, fill=glow_color, width=4, smooth=True)
            # Main line
            self.create_line(*pts, fill=self.color, width=1, smooth=True)

        # Playback position indicator
        if self.is_playing:
            px = int(self.play_pos * w)
            self.create_line(px, 0, px, h, fill=blend_hex(C["white"], C["bg2"], 0.2), width=1)
            # Glow
            self.create_line(px-1, 0, px-1, h, fill=blend_hex(self.color, C["bg2"], 0.75), width=2)


class StemTrack(tk.Frame):
    """A single stem track row with waveform, controls, and playback."""

    def __init__(self, parent, name, app, **kwargs):
        super().__init__(parent, bg=C["panel"], **kwargs)
        self.name = name
        self.app = app
        self.meta = STEM_META.get(name, STEM_META["other"])
        self.wav_path = None
        self.volume = tk.DoubleVar(value=1.0)
        self.muted = tk.BooleanVar(value=False)
        self.channel = None  # pygame channel
        self.sound = None
        self.memory_audio = None
        self._build()

    def _build(self):
        color = self.meta["color"]

        # Left accent bar
        accent = tk.Frame(self, bg=color, width=3)
        accent.pack(side="left", fill="y")

        # Main content
        body = tk.Frame(self, bg=C["panel"])
        body.pack(side="left", fill="both", expand=True, padx=(8, 8), pady=6)

        # ── Row 1: header ──
        hdr = tk.Frame(body, bg=C["panel"])
        hdr.pack(fill="x")

        icon_lbl = tk.Label(hdr, text=self.meta["icon"], fg=color, bg=C["panel"],
                            font=("Courier", 14, "bold"), width=2)
        icon_lbl.pack(side="left")

        name_lbl = tk.Label(hdr, text=self.meta["label"], fg=color, bg=C["panel"],
                            font=("Courier", 11, "bold"), anchor="w")
        name_lbl.pack(side="left", padx=(4, 0))

        desc_lbl = tk.Label(hdr, text=self.meta["desc"], fg=C["text_dim"], bg=C["panel"],
                            font=("Courier", 7), anchor="w")
        desc_lbl.pack(side="left", padx=(6, 0))

        # Status dot
        self.status_dot = tk.Label(hdr, text="●", fg=C["text_muted"], bg=C["panel"],
                                   font=("Courier", 8))
        self.status_dot.pack(side="right", padx=4)

        # File size / duration label
        self.info_lbl = tk.Label(hdr, text="—", fg=C["text_muted"], bg=C["panel"],
                                 font=("Courier", 7))
        self.info_lbl.pack(side="right", padx=4)

        # ── Row 2: waveform ──
        self.waveform = WaveformCanvas(body, color=color, height=48)
        self.waveform.pack(fill="x", pady=(4, 4))

        # ── Row 3: controls ──
        ctrl = tk.Frame(body, bg=C["panel"])
        ctrl.pack(fill="x")

        # Play button
        self.play_btn = tk.Button(ctrl, text="▶", fg=color, bg=C["bg3"],
                                  activebackground=C["bg2"], activeforeground=C["white"],
                                  relief="flat", width=3, font=("Courier", 9, "bold"),
                                  cursor="hand2", command=self.toggle_play,
                                  state="disabled")
        self.play_btn.pack(side="left", padx=(0, 4))

        # Stop button
        self.stop_btn = tk.Button(ctrl, text="■", fg=C["text_dim"], bg=C["bg3"],
                                  activebackground=C["bg2"], activeforeground=C["white"],
                                  relief="flat", width=3, font=("Courier", 9),
                                  cursor="hand2", command=self.stop,
                                  state="disabled")
        self.stop_btn.pack(side="left", padx=(0, 8))

        # Mute
        self.mute_btn = tk.Button(ctrl, text="M", fg=C["text_dim"], bg=C["bg3"],
                                  activebackground=C["bg2"], activeforeground=C["orange"],
                                  relief="flat", width=3, font=("Courier", 8, "bold"),
                                  cursor="hand2", command=self.toggle_mute,
                                  state="disabled")
        self.mute_btn.pack(side="left", padx=(0, 8))

        # Volume label
        vol_lbl = tk.Label(ctrl, text="VOL", fg=C["text_muted"], bg=C["panel"],
                           font=("Courier", 7))
        vol_lbl.pack(side="left")

        # Volume slider
        self.vol_slider = ttk.Scale(ctrl, from_=0, to=1, orient="horizontal",
                                    variable=self.volume, length=100,
                                    command=self._on_volume)
        self.vol_slider.pack(side="left", padx=(4, 8))

        # Volume %
        self.vol_pct = tk.Label(ctrl, text="100%", fg=color, bg=C["panel"],
                                font=("Courier", 8), width=5)
        self.vol_pct.pack(side="left")

        # Open file location button
        self.locate_btn = tk.Button(ctrl, text="📁 LOCATE", fg=C["text_dim"], bg=C["bg3"],
                                    activebackground=C["bg2"], activeforeground=C["cyan"],
                                    relief="flat", font=("Courier", 7),
                                    cursor="hand2", command=self.locate_file,
                                    state="disabled")
        self.locate_btn.pack(side="right", padx=(0, 4))

        # Playing indicator
        self.playing_lbl = tk.Label(ctrl, text="", fg=color, bg=C["panel"],
                                    font=("Courier", 7))
        self.playing_lbl.pack(side="right", padx=4)

        self._is_playing = False

    def set_ready(self, wav_path):
        self.wav_path = wav_path
        self.memory_audio = None
        color = self.meta["color"]

        # Update status
        self.status_dot.config(fg=color)

        # File info
        try:
            sz = os.path.getsize(wav_path) / (1024*1024)
            with wave.open(wav_path, 'rb') as wf:
                dur = wf.getnframes() / wf.getframerate()
            self.info_lbl.config(text=f"{dur:.1f}s  {sz:.1f}MB")
        except Exception:
            pass

        # Load waveform
        samples = read_wav_samples(wav_path)
        self.waveform.set_samples(samples)

        # Enable controls
        for btn in [self.play_btn, self.stop_btn, self.mute_btn, self.locate_btn]:
            btn.config(state="normal")

        # Load sound
        if PYGAME_OK:
            try:
                self.sound = pygame.mixer.Sound(wav_path)
                self.sound.set_volume(self.volume.get())
            except Exception:
                pass

    def set_ready_memory(self, audio_np, sample_rate):
        """Load stem directly from in-memory float audio [-1, 1], shape [samples, channels]."""
        self.wav_path = None
        self.memory_audio = (audio_np, int(sample_rate))
        color = self.meta["color"]
        self.status_dot.config(fg=color)

        # Info
        try:
            n_samples = int(audio_np.shape[0])
            dur = n_samples / float(sample_rate)
            mb = (audio_np.nbytes / (1024 * 1024))
            self.info_lbl.config(text=f"{dur:.1f}s  RAM {mb:.1f}MB")
        except Exception:
            pass

        # Waveform from first channel
        try:
            mono = audio_np[:, 0] if audio_np.ndim > 1 else audio_np
            mx = np.max(np.abs(mono)) or 1.0
            disp = (mono / mx).astype(np.float32)
            if len(disp) > 8000:
                step = max(1, len(disp) // 8000)
                disp = disp[::step][:8000]
            self.waveform.set_samples(disp)
        except Exception:
            self.waveform.set_samples(np.zeros(100))

        # Enable controls, but no locate for RAM-backed audio
        for btn in [self.play_btn, self.stop_btn, self.mute_btn]:
            btn.config(state="normal")
        self.locate_btn.config(state="disabled")

        if PYGAME_OK:
            try:
                arr = np.clip(audio_np, -1.0, 1.0)
                if arr.ndim == 1:
                    arr = np.column_stack([arr, arr])
                elif arr.shape[1] == 1:
                    arr = np.column_stack([arr[:, 0], arr[:, 0]])
                int16 = (arr * 32767.0).astype(np.int16)
                self.sound = pygame.sndarray.make_sound(int16)
                self.sound.set_volume(self.volume.get())
            except Exception:
                self.sound = None

    def toggle_play(self):
        if self._is_playing:
            self.stop()
        else:
            self.play()

    def play(self):
        if not self.wav_path and self.memory_audio is None and not self.sound:
            return
        if PYGAME_OK and self.sound:
            if self.muted.get():
                return
            self.channel = self.sound.play()
            self._is_playing = True
            self.play_btn.config(text="⏸")
            self.playing_lbl.config(text="◀ PLAYING")
            self.waveform.set_playing(True)
        else:
            # Fallback: open with system player
            try:
                if sys.platform == "darwin":
                    subprocess.Popen(["open", self.wav_path])
                elif sys.platform.startswith("linux"):
                    subprocess.Popen(["xdg-open", self.wav_path])
                else:
                    os.startfile(self.wav_path)
            except Exception:
                pass

    def stop(self):
        if PYGAME_OK and self.sound:
            self.sound.stop()
        self._is_playing = False
        self.play_btn.config(text="▶")
        self.playing_lbl.config(text="")
        self.waveform.set_playing(False)

    def toggle_mute(self):
        self.muted.set(not self.muted.get())
        if self.muted.get():
            self.mute_btn.config(fg=C["orange"])
            if PYGAME_OK and self.sound:
                self.sound.set_volume(0)
        else:
            self.mute_btn.config(fg=C["text_dim"])
            if PYGAME_OK and self.sound:
                self.sound.set_volume(self.volume.get())

    def _on_volume(self, val):
        v = float(val)
        self.vol_pct.config(text=f"{int(v*100)}%")
        if PYGAME_OK and self.sound and not self.muted.get():
            self.sound.set_volume(v)

    def locate_file(self):
        if self.wav_path and os.path.exists(self.wav_path):
            folder = os.path.dirname(self.wav_path)
            try:
                if sys.platform == "darwin":
                    subprocess.Popen(["open", "-R", self.wav_path])
                elif sys.platform.startswith("linux"):
                    subprocess.Popen(["xdg-open", folder])
                else:
                    subprocess.Popen(["explorer", "/select,", self.wav_path])
            except Exception:
                messagebox.showinfo("File Location", self.wav_path)


class NeuralStemApp:

    def __init__(self, root):
        self.root = root
        self.root.title("NEURAL STEM  —  AI Audio Separator")
        self.root.configure(bg=C["bg"])
        self.root.geometry("980x820")
        self.root.minsize(820, 680)

        self.mp3_path = None
        self.output_dir = tk.StringVar(value=str(Path.home() / "NeuralStem_Output"))
        self.selected_model = tk.StringVar(value="htdemucs_6s")
        self.ui_scale = tk.DoubleVar(value=1.2)
        self.auto_open_output = tk.BooleanVar(value=False)
        self.auto_play_after_separation = tk.BooleanVar(value=False)
        self.stem_tracks = {}
        self._sep_thread = None
        self._font_base = {}
        self._settings_path = Path.home() / ".neural_stem_settings.json"
        self._log_path = Path(__file__).resolve().parent / "log.txt"

        self._load_settings()

        self._setup_styles()
        self._build_ui()
        self.selected_model.trace_add("write", self._on_model_changed)
        self.root.after(30, self.apply_font_scale)
        self._animate_header()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TScale",
                        background=C["panel"],
                        troughcolor=C["bg3"],
                        sliderthickness=12)
        style.configure("Separator.TFrame", background=C["border"])
        style.configure("TProgressbar",
                        background=C["cyan"],
                        troughcolor=C["bg3"],
                        bordercolor=C["bg3"],
                        lightcolor=C["cyan"],
                        darkcolor=C["cyan_dim"])

    def _build_ui(self):
        # ── HEADER ──
        hdr = tk.Frame(self.root, bg=C["bg"], height=80)
        hdr.pack(fill="x", padx=0, pady=0)
        hdr.pack_propagate(False)

        # Decorative left bar
        tk.Frame(hdr, bg=C["cyan"], width=4).pack(side="left", fill="y")

        hdr_inner = tk.Frame(hdr, bg=C["bg"])
        hdr_inner.pack(side="left", fill="both", expand=True, padx=16, pady=8)

        title_row = tk.Frame(hdr_inner, bg=C["bg"])
        title_row.pack(fill="x")

        self.title_lbl = tk.Label(title_row, text="NEURAL STEM",
                                  fg=C["cyan_glow"], bg=C["bg"],
                                  font=("Courier", 24, "bold"))
        self.title_lbl.pack(side="left")

        version_lbl = tk.Label(title_row, text="v2.0  AI AUDIO SEPARATOR",
                               fg=C["cyan_dim"], bg=C["bg"],
                               font=("Courier", 9))
        version_lbl.pack(side="left", padx=(12, 0), pady=(8, 0))

        # Status badge
        self.status_badge = tk.Label(title_row, text="● READY",
                                     fg=C["green"], bg=C["bg"],
                                     font=("Courier", 9, "bold"))
        self.status_badge.pack(side="right", padx=8)
        self._cyber_btn(title_row, "SETTINGS", self.open_settings,
                        C["text"], font_size=8).pack(side="right", padx=(0, 6))

        sub_lbl = tk.Label(hdr_inner,
                           text="Powered by Meta Demucs · Isolate vocals, drums, bass, guitar, piano & more",
                           fg=C["text_dim"], bg=C["bg"], font=("Courier", 8))
        sub_lbl.pack(anchor="w")

        # Decorative right scan-line
        self.scan_lbl = tk.Label(hdr, text="▮▮▮▮▮▮▮▯▯▯▯▯▯▯▯",
                                 fg=C["cyan_dim"], bg=C["bg"],
                                 font=("Courier", 7))
        self.scan_lbl.pack(side="right", padx=16)

        # ── SEPARATOR LINE ──
        tk.Frame(self.root, bg=C["border"], height=1).pack(fill="x")
        tk.Frame(self.root, bg=blend_hex(C["cyan"], C["bg"], 0.8), height=1).pack(fill="x")

        # ── MAIN CONTENT ──
        content = tk.Frame(self.root, bg=C["bg"])
        content.pack(fill="both", expand=True, padx=0, pady=0)

        # Left panel
        left = tk.Frame(content, bg=C["bg2"], width=300)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        self._build_left_panel(left)

        # Divider
        tk.Frame(content, bg=C["border"], width=1).pack(side="left", fill="y")

        # Right panel — stem tracks
        right = tk.Frame(content, bg=C["bg"])
        right.pack(side="left", fill="both", expand=True)
        self._build_right_panel(right)

    def _build_left_panel(self, parent):
        # ── INPUT FILE ──
        section = self._section(parent, "01  INPUT FILE")

        # Drop zone
        self.dropzone = tk.Canvas(section, bg=C["bg3"], height=90,
                                  highlightthickness=1,
                                  highlightbackground=C["border"])
        self.dropzone.pack(fill="x", padx=12, pady=(0, 8))
        self.dropzone.bind("<Button-1>", lambda e: self.browse_file())
        self.dropzone.bind("<Configure>", self._draw_dropzone)
        self._draw_dropzone()

        # File info
        self.file_lbl = tk.Label(section, text="No file selected",
                                 fg=C["text_muted"], bg=C["bg2"],
                                 font=("Courier", 8), wraplength=260, justify="left")
        self.file_lbl.pack(anchor="w", padx=12, pady=(0, 4))

        btn_row = tk.Frame(section, bg=C["bg2"])
        btn_row.pack(fill="x", padx=12, pady=(0, 12))

        self._cyber_btn(btn_row, "◈ BROWSE FILE", self.browse_file, C["cyan"]).pack(side="left")

        # ── MODEL SELECTION ──
        section2 = self._section(parent, "02  SEPARATION MODEL")

        for key, label in MODELS.items():
            row = tk.Frame(section2, bg=C["bg2"])
            row.pack(fill="x", padx=12, pady=1)
            rb = tk.Radiobutton(row, text=label[:50], variable=self.selected_model,
                                value=key, fg=C["text"], bg=C["bg2"],
                                selectcolor=C["bg3"], activebackground=C["bg2"],
                                activeforeground=C["cyan"],
                                font=("Courier", 7), anchor="w",
                                indicatoron=1, cursor="hand2")
            rb.pack(fill="x")

        # ── OUTPUT DIR ──
        section3 = self._section(parent, "03  OUTPUT DIRECTORY")

        out_frame = tk.Frame(section3, bg=C["bg2"])
        out_frame.pack(fill="x", padx=12, pady=(0, 4))

        self.out_entry = tk.Entry(out_frame, textvariable=self.output_dir,
                                  bg=C["bg3"], fg=C["text"], insertbackground=C["cyan"],
                                  relief="flat", font=("Courier", 7),
                                  highlightthickness=1, highlightcolor=C["cyan"],
                                  highlightbackground=C["border"])
        self.out_entry.pack(side="left", fill="x", expand=True, ipady=4, padx=(0, 4))

        self._cyber_btn(out_frame, "…", self.browse_output, C["text_dim"],
                        width=3).pack(side="right")

        self._cyber_btn(section3, "📁 OPEN OUTPUT FOLDER", self.open_output_folder,
                        C["text_dim"], font_size=7).pack(padx=12, pady=(0, 12), anchor="w")

        # ── SEPARATE BUTTON ──
        separator_outer = tk.Frame(parent, bg=C["bg2"])
        separator_outer.pack(fill="x", padx=0, pady=8)

        self.sep_btn = tk.Button(separator_outer,
                                 text="⚡  SEPARATE STEMS",
                                 fg=C["bg"], bg=C["cyan"],
                                 activebackground=C["cyan_glow"],
                                 activeforeground=C["bg"],
                                 relief="flat", font=("Courier", 12, "bold"),
                                 cursor="hand2", pady=12,
                                 command=self.start_separation)
        self.sep_btn.pack(fill="x", padx=12, ipady=2)

        # ── PROGRESS ──
        prog_frame = tk.Frame(parent, bg=C["bg2"])
        prog_frame.pack(fill="x", padx=12, pady=(4, 0))

        self.progress_var = tk.DoubleVar(value=0)
        self.progress_bar = ttk.Progressbar(prog_frame, variable=self.progress_var,
                                             maximum=100, style="TProgressbar",
                                             length=260)
        self.progress_bar.pack(fill="x")

        self.progress_lbl = tk.Label(parent, text="",
                                     fg=C["cyan_dim"], bg=C["bg2"],
                                     font=("Courier", 7))
        self.progress_lbl.pack(anchor="w", padx=12, pady=(2, 0))

        # ── LOG ──
        log_section = self._section(parent, "SYSTEM LOG")

        log_frame = tk.Frame(log_section, bg=C["bg3"],
                             highlightthickness=1, highlightbackground=C["border"])
        log_frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        self.log_text = tk.Text(log_frame, bg=C["bg3"], fg=C["green"],
                                font=("Courier", 7), relief="flat",
                                state="disabled", height=8, wrap="none",
                                insertbackground=C["cyan"])
        y_scrollbar = tk.Scrollbar(log_frame, command=self.log_text.yview,
                                   bg=C["bg3"], troughcolor=C["bg3"])
        x_scrollbar = tk.Scrollbar(log_frame, orient="horizontal", command=self.log_text.xview,
                                   bg=C["bg3"], troughcolor=C["bg3"])
        self.log_text.configure(yscrollcommand=y_scrollbar.set, xscrollcommand=x_scrollbar.set)
        self.log_text.pack(side="left", fill="both", expand=True)
        y_scrollbar.pack(side="right", fill="y")
        x_scrollbar.pack(side="bottom", fill="x")

        self._log("System initialized.")
        self._log(f"Demucs ready · PyGame: {'OK' if PYGAME_OK else 'OFF'}")

    def _draw_dropzone(self, event=None):
        c = self.dropzone
        c.delete("all")
        w = c.winfo_width() or 260
        h = c.winfo_height() or 90
        # Corner decorations
        sz = 12
        for x, y, dx, dy in [(4,4,1,1),(w-4,4,-1,1),(4,h-4,1,-1),(w-4,h-4,-1,-1)]:
            c.create_line(x, y, x+dx*sz, y, fill=C["cyan"], width=2)
            c.create_line(x, y, x, y+dy*sz, fill=C["cyan"], width=2)
        # Center icon + text
        c.create_text(w//2, h//2 - 12, text="◈", fill=C["cyan_dim"],
                      font=("Courier", 18))
        c.create_text(w//2, h//2 + 10, text="CLICK TO SELECT MP3 / WAV / FLAC",
                      fill=C["text_muted"], font=("Courier", 7))

    def _build_right_panel(self, parent):
        # Header row
        rh = tk.Frame(parent, bg=C["bg"])
        rh.pack(fill="x", padx=16, pady=(12, 4))

        tk.Label(rh, text="STEM TRACKS", fg=C["cyan"], bg=C["bg"],
                 font=("Courier", 11, "bold")).pack(side="left")

        # Global controls
        ctrl_row = tk.Frame(rh, bg=C["bg"])
        ctrl_row.pack(side="right")

        self._cyber_btn(ctrl_row, "▶ PLAY ALL", self.play_all,
                        C["green"], font_size=8).pack(side="left", padx=4)
        self._cyber_btn(ctrl_row, "■ STOP ALL", self.stop_all,
                        C["orange"], font_size=8).pack(side="left", padx=4)

        tk.Frame(parent, bg=C["border"], height=1).pack(fill="x", padx=16)

        # Scrollable track area
        scroll_container = tk.Frame(parent, bg=C["bg"])
        scroll_container.pack(fill="both", expand=True, padx=16, pady=8)

        canvas = tk.Canvas(scroll_container, bg=C["bg"], highlightthickness=0)
        scrollbar = tk.Scrollbar(scroll_container, orient="vertical",
                                  command=canvas.yview, bg=C["bg3"])
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        self.tracks_frame = tk.Frame(canvas, bg=C["bg"])
        tracks_window = canvas.create_window((0, 0), window=self.tracks_frame,
                                              anchor="nw")

        def on_configure(e):
            canvas.configure(scrollregion=canvas.bbox("all"))
            canvas.itemconfig(tracks_window, width=canvas.winfo_width())

        self.tracks_frame.bind("<Configure>", on_configure)
        canvas.bind("<Configure>", on_configure)

        # Mousewheel
        def on_wheel(e):
            delta = 0
            if hasattr(e, "delta") and e.delta:
                delta = int(-1 * (e.delta / 120))
            elif getattr(e, "num", None) == 4:
                delta = -1
            elif getattr(e, "num", None) == 5:
                delta = 1
            if delta:
                canvas.yview_scroll(delta, "units")

        canvas.bind_all("<MouseWheel>", on_wheel)
        canvas.bind_all("<Button-4>", on_wheel)
        canvas.bind_all("<Button-5>", on_wheel)

        def cleanup_bindings(_e=None):
            try:
                canvas.unbind_all("<MouseWheel>")
                canvas.unbind_all("<Button-4>")
                canvas.unbind_all("<Button-5>")
            except Exception:
                pass

        self.root.bind("<Destroy>", cleanup_bindings, add="+")

        self.no_tracks_lbl = tk.Label(
            self.tracks_frame,
            text="No separated stems yet.\nRun SEPARATE STEMS to generate tracks.",
            fg=C["text_dim"], bg=C["bg"], font=("Courier", 9), justify="center"
        )
        self.no_tracks_lbl.pack(fill="both", expand=True, pady=24)

    def _build_stem_placeholders(self):
        # Determine stems for selected model
        model = self.selected_model.get()
        if model == "htdemucs_6s":
            stems = ["vocals", "drums", "bass", "guitar", "piano", "other"]
        else:
            stems = ["vocals", "drums", "bass", "other"]

        for w in self.tracks_frame.winfo_children():
            w.destroy()
        self.stem_tracks = {}

        for stem in stems:
            track = StemTrack(self.tracks_frame, stem, self)
            track.pack(fill="x", pady=(0, 4))
            self.stem_tracks[stem] = track
        self.apply_font_scale()

    def _clear_stem_tracks(self):
        for w in self.tracks_frame.winfo_children():
            w.destroy()
        self.stem_tracks = {}
        self.no_tracks_lbl = tk.Label(
            self.tracks_frame,
            text="No separated stems yet.\nRun SEPARATE STEMS to generate tracks.",
            fg=C["text_dim"], bg=C["bg"], font=("Courier", 9), justify="center"
        )
        self.no_tracks_lbl.pack(fill="both", expand=True, pady=24)
        self.apply_font_scale()

    # ── Helper builders ──

    def _section(self, parent, title):
        frame = tk.Frame(parent, bg=C["bg2"])
        frame.pack(fill="x")
        hdr = tk.Frame(frame, bg=C["bg2"])
        hdr.pack(fill="x", padx=0, pady=0)
        tk.Frame(hdr, bg=C["cyan"], width=2).pack(side="left", fill="y")
        tk.Label(hdr, text=f" {title}", fg=C["cyan_dim"], bg=C["bg2"],
                 font=("Courier", 8, "bold")).pack(side="left", pady=6)
        tk.Frame(frame, bg=C["border2"], height=1).pack(fill="x")
        return frame

    def _cyber_btn(self, parent, text, cmd, color, font_size=9, width=None):
        kw = dict(font=("Courier", font_size, "bold")) if font_size else {}
        btn = tk.Button(parent, text=text, command=cmd,
                        fg=color, bg=C["bg3"],
                        activebackground=C["bg2"], activeforeground=color,
                        relief="flat", cursor="hand2",
                        padx=8, pady=4,
                        **kw)
        if width:
            btn.config(width=width)
        return btn

    # ── File / Dir browsing ──

    def browse_file(self):
        path = filedialog.askopenfilename(
            title="Select Audio File",
            filetypes=[("Audio Files", "*.mp3 *.wav *.flac *.aac *.ogg *.m4a"),
                       ("All Files", "*.*")]
        )
        if path:
            self.mp3_path = path
            name = os.path.basename(path)
            sz = os.path.getsize(path) / (1024*1024)
            self.file_lbl.config(text=f"{name}\n{sz:.1f} MB", fg=C["cyan"])
            self._log(f"Loaded: {name}")
            # Auto-suggest output dir
            stem_name = Path(path).stem
            out = str(Path(path).parent / "NeuralStem" / stem_name)
            self.output_dir.set(out)
            self._clear_stem_tracks()

    def browse_output(self):
        d = filedialog.askdirectory(title="Select Output Directory")
        if d:
            self.output_dir.set(d)

    def open_output_folder(self):
        d = self.output_dir.get()
        os.makedirs(d, exist_ok=True)
        try:
            if sys.platform == "darwin":
                subprocess.Popen(["open", d])
            elif sys.platform.startswith("linux"):
                subprocess.Popen(["xdg-open", d])
            else:
                os.startfile(d)
        except Exception as e:
            messagebox.showerror("Error", str(e))

    # ── Separation ──

    def start_separation(self):
        if not self.mp3_path:
            messagebox.showwarning("No File", "Please select an audio file first.")
            return
        if self._sep_thread and self._sep_thread.is_alive():
            messagebox.showinfo("Busy", "Separation already in progress.")
            return

        self.sep_btn.config(state="disabled", text="⏳  PROCESSING...")
        self.status_badge.config(text="● PROCESSING", fg=C["yellow"])
        self._build_stem_placeholders()
        self.progress_var.set(0)

        model = self.selected_model.get()
        out_dir = self.output_dir.get()
        mp3_path = self.mp3_path
        self._last_sep_request = (model, out_dir, mp3_path)
        self._sep_thread = threading.Thread(
            target=self._run_separation,
            args=(model, out_dir, mp3_path),
            daemon=True
        )
        self._sep_thread.start()
        self._poll_progress()

    def _run_separation(self, model, out_dir, mp3_path):
        try:
            os.makedirs(out_dir, exist_ok=True)

            self._log(f"Starting separation with model: {model}")
            self._log(f"Input: {os.path.basename(mp3_path)}")
            self._log(f"Output: {out_dir}")
            self._update_progress(5, "Initializing Demucs model...")

            cmd = [
                sys.executable, "-m", "demucs",
                "--two-stems", "none",  # will be overridden by model default
                "-n", model,
                "-o", out_dir,
                "--mp3",  # save as mp3 to save space
                "--mp3-bitrate", "320",
                self.mp3_path
            ]
            # Actually use default (all stems) by removing two-stems flag
            cmd = [
                sys.executable, "-m", "demucs",
                "-n", model,
                "-o", out_dir,
                mp3_path
            ]

            self._update_progress(10, "Loading model weights...")
            self._log("Running Demucs separation (this may take 1-5 minutes)...")

            rc, output_lines = self._run_demucs_process(cmd, env=None)

            if rc != 0:
                self._log(f"ERROR: Demucs exited with code {rc}")
                out_text = "\n".join(output_lines).lower()
                if "could not load libtorchcodec" in out_text:
                    self._log("TorchCodec native load failed. Retrying with legacy torchaudio backend...")
                    legacy_env = os.environ.copy()
                    legacy_env["TORCHAUDIO_USE_BACKEND_DISPATCHER"] = "0"
                    rc2, output2 = self._run_demucs_process(cmd, env=legacy_env)
                    if rc2 == 0:
                        self._log("Fallback run succeeded with legacy torchaudio backend.")
                        self._update_progress(95, "Locating output files...")
                        self._find_and_load_stems(out_dir, model, mp3_path)
                        self._update_progress(100, "Complete!")
                        self.root.after(0, self._on_separation_done)
                        return
                    out_text = "\n".join(output2).lower()
                    self._log(f"Fallback also failed (code {rc2}).")
                    self._log("Trying in-memory separation (no stem files on disk)...")
                    ok = self._separate_in_memory(model, mp3_path)
                    if ok:
                        self._update_progress(100, "Complete (in-memory stems)")
                        self.root.after(0, self._on_separation_done)
                        return
                    self.root.after(0, lambda: self._on_libtorchcodec_failed())
                    return
                if "no module named 'torchcodec'" in out_text or "torchcodec is required" in out_text:
                    self.root.after(0, self._on_missing_torchcodec)
                    return
                self.root.after(0, lambda: self._on_separation_failed())
                return

            self._update_progress(95, "Locating output files...")
            self._find_and_load_stems(out_dir, model, mp3_path)
            self._update_progress(100, "Complete!")
            self.root.after(0, self._on_separation_done)

        except Exception as e:
            self._log(f"EXCEPTION: {e}")
            import traceback
            self._log(traceback.format_exc()[:200])
            self.root.after(0, lambda: self._on_separation_failed())

    def _run_demucs_process(self, cmd, env=None):
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env
        )
        progress = 10
        output_lines = []
        for line in process.stdout:
            line = line.strip()
            if not line:
                continue
            output_lines.append(line)
            self._log(line)
            if "%" in line:
                try:
                    pct = float(line.split("%")[0].split()[-1])
                    progress = 10 + int(pct * 0.85)
                    self._update_progress(progress, f"Separating... {pct:.0f}%")
                except Exception:
                    pass
            elif "segment" in line.lower() or "chunk" in line.lower():
                progress = min(progress + 2, 90)
                self._update_progress(progress, "Processing audio chunks...")
        process.wait()
        return process.returncode, output_lines

    def _separate_in_memory(self, model_name, mp3_path):
        """Fallback: separate stems in RAM and avoid saving via torchaudio."""
        try:
            import torch
            import torchaudio
            from demucs.pretrained import get_model
            from demucs.apply import apply_model
        except Exception as e:
            self._log(f"In-memory mode unavailable: {e}")
            return False

        try:
            self._update_progress(12, "Loading audio in memory...")
            wav, sr = torchaudio.load(mp3_path)
            if wav.dim() == 1:
                wav = wav.unsqueeze(0)
            if wav.shape[0] == 1:
                wav = wav.repeat(2, 1)
            wav = wav[:2, :]

            self._update_progress(18, f"Loading model in memory: {model_name}...")
            model = get_model(model_name)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model.to(device)
            model.eval()
            wav = wav.to(device)

            self._update_progress(25, "Separating in memory...")
            with torch.no_grad():
                sources = apply_model(model, wav.unsqueeze(0), split=True, overlap=0.25, progress=False)[0]
            # sources: [stems, channels, samples]
            sources = sources.detach().cpu()
            stem_names = list(getattr(model, "sources", []))
            if not stem_names:
                stem_names = ["drums", "bass", "other", "vocals"][:sources.shape[0]]

            loaded_count = 0
            self.root.after(0, self._build_stem_placeholders)
            for idx, stem_name in enumerate(stem_names):
                if idx >= sources.shape[0]:
                    break
                if stem_name not in self.stem_tracks:
                    continue
                stem_tensor = sources[idx].transpose(0, 1).contiguous()  # [samples, channels]
                audio_np = stem_tensor.numpy().astype(np.float32)
                loaded_count += 1
                self.root.after(
                    0,
                    lambda t=self.stem_tracks[stem_name], a=audio_np, rate=int(sr): t.set_ready_memory(a, rate)
                )

            if loaded_count == 0:
                self._log("In-memory separation produced no matching stems for selected UI model.")
                return False
            self._log(f"In-memory separation complete. Loaded {loaded_count} stems.")
            return True
        except Exception as e:
            self._log(f"In-memory separation failed: {e}")
            return False

    def _find_and_load_stems(self, out_dir, model, mp3_path):
        """Find the output wav files and load them into track widgets."""
        song_name = Path(mp3_path).stem
        # Demucs outputs to: out_dir / model / song_name / stem.wav
        stem_dir = Path(out_dir) / model / song_name

        if not stem_dir.exists():
            # Try to find it
            for root, dirs, files in os.walk(out_dir):
                for f in files:
                    if f.endswith(('.wav', '.mp3')) and any(
                        s in f.lower() for s in ['vocals','drums','bass','guitar','piano','other']
                    ):
                        stem_dir = Path(root)
                        break

        self._log(f"Looking for stems in: {stem_dir}")

        if stem_dir.exists():
            if not self.stem_tracks:
                self.root.after(0, self._build_stem_placeholders)
                self.root.after(30, lambda: self._find_and_load_stems(out_dir, model, mp3_path))
                return
            for stem_name, track in self.stem_tracks.items():
                for ext in ['.wav', '.mp3']:
                    p = stem_dir / f"{stem_name}{ext}"
                    if p.exists():
                        self._log(f"Found: {p.name}")
                        self.root.after(0, lambda t=track, path=str(p): t.set_ready(path))
                        break

    def _on_separation_done(self):
        self.sep_btn.config(state="normal", text="SEPARATE STEMS")
        self.status_badge.config(text="● COMPLETE", fg=C["green"])
        self._log("✓ Separation complete! Stems ready.")
        if self.auto_open_output.get():
            self.open_output_folder()
        if self.auto_play_after_separation.get():
            self.play_all()
        messagebox.showinfo("Done", "Stem separation complete!\nAll tracks are now ready to play.")

    def _on_separation_failed(self):
        self.sep_btn.config(state="normal", text="SEPARATE STEMS")
        self.status_badge.config(text="● ERROR", fg=C["orange"])
        messagebox.showerror("Error", "Separation failed. Check the system log for details.")

    def _on_missing_torchcodec(self):
        self.sep_btn.config(state="normal", text="SEPARATE STEMS")
        self.status_badge.config(text="MISSING DEP", fg=C["orange"])
        self._log("TorchCodec missing. Demucs cannot save output stems.")
        install = messagebox.askyesno(
            "Missing Dependency",
            "Demucs needs torchcodec to save stems.\n\nInstall it now and retry automatically?"
        )
        if not install:
            self._log(f"Manual fix: {sys.executable} -m pip install torchcodec")
            return
        self._log("Installing torchcodec...")
        threading.Thread(target=self._install_torchcodec_and_retry, daemon=True).start()
    def _on_libtorchcodec_failed(self):
        self.sep_btn.config(state="normal", text="SEPARATE STEMS")
        self.status_badge.config(text="TORCHCODEC/FFMPEG ERROR", fg=C["orange"])
        messagebox.showerror(
            "TorchCodec Runtime Error",
            "TorchCodec is installed but failed to load native libraries.\n\n"
            "App retried once with legacy torchaudio backend and it still failed.\n"
            "Install FFmpeg full-shared build and ensure torch/torchaudio/torchcodec versions are compatible."
        )
    def _install_torchcodec_and_retry(self):
        try:
            cmd = [sys.executable, "-m", "pip", "install", "torchcodec"]
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            for line in process.stdout:
                line = line.strip()
                if line:
                    self._log(f"pip: {line}")
            process.wait()
            if process.returncode != 0:
                self._log("TorchCodec install failed.")
                self.root.after(
                    0,
                    lambda: messagebox.showerror(
                        "Install Failed",
                        "Failed to install torchcodec automatically.\n"
                        f"Run manually:\n{sys.executable} -m pip install torchcodec"
                    )
                )
                return

            self._log("TorchCodec installed successfully.")
            self.root.after(
                0,
                lambda: messagebox.showinfo("Installed", "torchcodec installed. Separation will restart.")
            )
            if hasattr(self, "_last_sep_request") and self._last_sep_request:
                self.root.after(0, self.start_separation)
        except Exception as e:
            self._log(f"Install exception: {e}")
            self.root.after(
                0,
                lambda: messagebox.showerror(
                    "Install Error",
                    f"Could not install torchcodec automatically.\n{e}"
                )
            )

    def _update_progress(self, val, msg=""):
        self.root.after(0, lambda: self.progress_var.set(val))
        self.root.after(0, lambda: self.progress_lbl.config(text=msg))

    def _poll_progress(self):
        if self._sep_thread and self._sep_thread.is_alive():
            self.root.after(200, self._poll_progress)

    def _on_model_changed(self, *_args):
        if self.stem_tracks:
            self._build_stem_placeholders()

    # ── Global playback ──

    def play_all(self):
        for track in self.stem_tracks.values():
            if track.wav_path:
                track.play()

    def stop_all(self):
        for track in self.stem_tracks.values():
            track.stop()
        if PYGAME_OK:
            pygame.mixer.stop()

    # ── Log ──

    def _log(self, msg):
        def _do():
            ts = time.strftime("%H:%M:%S")
            line = f"[{ts}] {msg}"
            self.log_text.config(state="normal")
            self.log_text.insert("end", line + "\n")
            self.log_text.see("end")
            self.log_text.config(state="disabled")
            try:
                with open(self._log_path, "a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except Exception:
                pass
        self.root.after(0, _do)

    # ── Header animation ──

    def _animate_header(self):
        bars = ["▮▮▮▮▮▮▮▯▯▯▯▯▯▯▯", "▯▮▮▮▮▮▮▮▯▯▯▯▯▯▯",
                "▯▯▮▮▮▮▮▮▮▯▯▯▯▯▯", "▯▯▯▮▮▮▮▮▮▮▯▯▯▯▯",
                "▯▯▯▯▮▮▮▮▮▮▮▯▯▯▯", "▯▯▯▯▯▮▮▮▮▮▮▮▯▯▯",
                "▯▯▯▯▯▯▮▮▮▮▮▮▮▯▯", "▯▯▯▯▯▯▯▮▮▮▮▮▮▮▯",
                "▯▯▯▯▯▯▯▯▮▮▮▮▮▮▮", "▮▯▯▯▯▯▯▯▯▮▮▮▮▮▮"]
        if not hasattr(self, '_bar_idx'):
            self._bar_idx = 0
        self.scan_lbl.config(text=bars[self._bar_idx % len(bars)])
        self._bar_idx += 1
        self.root.after(180, self._animate_header)

    # Settings

    def _load_settings(self):
        try:
            if self._settings_path.exists():
                data = json.loads(self._settings_path.read_text(encoding="utf-8"))
                self.ui_scale.set(float(data.get("ui_scale", self.ui_scale.get())))
                self.auto_open_output.set(bool(data.get("auto_open_output", self.auto_open_output.get())))
                self.auto_play_after_separation.set(
                    bool(data.get("auto_play_after_separation", self.auto_play_after_separation.get()))
                )
                model = data.get("selected_model")
                if model in MODELS:
                    self.selected_model.set(model)
        except Exception:
            pass

    def _save_settings(self):
        try:
            data = {
                "ui_scale": round(float(self.ui_scale.get()), 2),
                "auto_open_output": bool(self.auto_open_output.get()),
                "auto_play_after_separation": bool(self.auto_play_after_separation.get()),
                "selected_model": self.selected_model.get(),
            }
            self._settings_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as e:
            self._log(f"Settings save warning: {e}")

    def apply_font_scale(self):
        scale = float(self.ui_scale.get())
        try:
            self.root.tk.call("tk", "scaling", scale)
        except Exception:
            pass
        self._apply_font_scale_recursive(self.root, scale)

    def _apply_font_scale_recursive(self, widget, scale):
        try:
            current = widget.cget("font")
        except Exception:
            current = None
        if current:
            key = str(widget)
            if key not in self._font_base:
                try:
                    f = tkfont.Font(font=current)
                    self._font_base[key] = (
                        f.actual("family"),
                        int(f.actual("size")),
                        f.actual("weight"),
                        f.actual("slant")
                    )
                except Exception:
                    self._font_base[key] = None
            base = self._font_base.get(key)
            if base:
                family, size, weight, slant = base
                if size == 0:
                    size = 1
                sign = -1 if size < 0 else 1
                new_size = max(6, int(round(abs(size) * scale))) * sign
                try:
                    widget.configure(font=(family, new_size, weight, slant))
                except Exception:
                    pass

        for child in widget.winfo_children():
            self._apply_font_scale_recursive(child, scale)

    def open_settings(self):
        win = tk.Toplevel(self.root)
        win.title("Settings")
        win.configure(bg=C["bg2"])
        win.geometry("460x340")
        win.resizable(False, False)
        win.transient(self.root)
        win.grab_set()

        box = tk.Frame(win, bg=C["bg2"])
        box.pack(fill="both", expand=True, padx=14, pady=14)

        tk.Label(box, text="DISPLAY", fg=C["cyan"], bg=C["bg2"],
                 font=("Courier", 10, "bold")).pack(anchor="w", pady=(0, 8))

        scale_row = tk.Frame(box, bg=C["bg2"])
        scale_row.pack(fill="x", pady=(0, 8))
        tk.Label(scale_row, text="Font Size", fg=C["text"], bg=C["bg2"],
                 font=("Courier", 9)).pack(side="left")
        pct_lbl = tk.Label(scale_row, text=f"{int(self.ui_scale.get() * 100)}%",
                           fg=C["cyan"], bg=C["bg2"], font=("Courier", 9, "bold"))
        pct_lbl.pack(side="right")

        slider = ttk.Scale(box, from_=0.9, to=2.1, orient="horizontal",
                           variable=self.ui_scale, length=360)
        slider.pack(anchor="w")

        def on_slider(_e=None):
            pct_lbl.config(text=f"{int(self.ui_scale.get() * 100)}%")
            self.apply_font_scale()

        slider.bind("<B1-Motion>", on_slider)
        slider.bind("<ButtonRelease-1>", on_slider)

        tk.Frame(box, bg=C["border2"], height=1).pack(fill="x", pady=12)
        tk.Label(box, text="BEHAVIOR", fg=C["cyan"], bg=C["bg2"],
                 font=("Courier", 10, "bold")).pack(anchor="w", pady=(0, 8))

        tk.Checkbutton(
            box, text="Open output folder when separation is done",
            variable=self.auto_open_output, fg=C["text"], bg=C["bg2"],
            selectcolor=C["bg3"], activebackground=C["bg2"], activeforeground=C["cyan"],
            font=("Courier", 8), anchor="w"
        ).pack(fill="x", pady=2)

        tk.Checkbutton(
            box, text="Auto-play all stems after separation",
            variable=self.auto_play_after_separation, fg=C["text"], bg=C["bg2"],
            selectcolor=C["bg3"], activebackground=C["bg2"], activeforeground=C["cyan"],
            font=("Courier", 8), anchor="w"
        ).pack(fill="x", pady=2)

        btn_row = tk.Frame(box, bg=C["bg2"])
        btn_row.pack(side="bottom", fill="x", pady=(14, 0))

        def save_and_close():
            self._save_settings()
            win.destroy()

        self._cyber_btn(btn_row, "SAVE", save_and_close, C["green"]).pack(side="right")
        self._cyber_btn(btn_row, "CANCEL", win.destroy, C["text_dim"]).pack(side="right", padx=(0, 8))


def main():
    root = tk.Tk()

    # Try to set dark title bar on some platforms
    try:
        root.tk.call('tk', 'scaling', 1.2)
    except Exception:
        pass

    app = NeuralStemApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()




