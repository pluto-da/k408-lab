# Build voice track from timeline, synthesize music, duck music under voice (sidechain), normalize to -14 LUFS / -1 dBTP.
# usage: python3 mix.py v|h
import json, subprocess, sys, re
V = sys.argv[1]
TL = json.load(open(f"build/timeline-{V}.json")); total = TL["total"]
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-3000:]); raise SystemExit(1)
    return r.stderr
# 1) voice track (48k stereo), clips placed at their start times
ins, flt = [], []
for i, (sid, st) in enumerate(TL["voice"]):
    ins += ["-i", f"tts/{sid}.wav"]
    ms = int(st * 1000)
    flt.append(f"[{i}:a]aresample=48000,highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=5:release=120,adelay={ms}|{ms},apad[a{i}]")
n = len(TL["voice"])
flt.append("".join(f"[a{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0:dropout_transition=0,atrim=0:{total},aformat=channel_layouts=stereo[v]")
run(["ffmpeg", "-y", "-loglevel", "error"] + ins + ["-filter_complex", ";".join(flt), "-map", "[v]", "-ar", "48000", f"build/voice-{V}.wav"])
# voice to -16 LUFS
run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"build/voice-{V}.wav", "-af", "loudnorm=I=-16:TP=-2:LRA=7", "-ar", "48000", f"build/voice-{V}-n.wav"])
# 2) music
run(["python3", "music.py", str(total), f"build/music-{V}.wav"])
# 3) duck + mix
fc = ("[1:a]volume=-3dB[m];[0:a]asplit=2[vk][vm];"
      "[m][vk]sidechaincompress=threshold=0.04:ratio=4:attack=20:release=350:makeup=1[md];"
      "[vm][md]amix=inputs=2:normalize=0:duration=longest,atrim=0:" + str(total) + "[mix]")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"build/voice-{V}-n.wav", "-i", f"build/music-{V}.wav", "-filter_complex", fc, "-map", "[mix]", "-ar", "48000", f"build/mix-{V}-raw.wav"])
# 4) two-pass loudnorm to -14 LUFS, -1 dBTP
err = run(["ffmpeg", "-hide_banner", "-i", f"build/mix-{V}-raw.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
js = json.loads(err[err.rindex("{"):err.rindex("}") + 1])
af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:"
      f"measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"build/mix-{V}-raw.wav", "-af", af, "-ar", "48000", f"build/audio-{V}.wav"])
out = run(["ffmpeg", "-hide_banner", "-i", f"build/audio-{V}.wav", "-af", "ebur128=peak=true", "-f", "null", "-"])
m = re.findall(r"I:\s+(-?[\d.]+) LUFS", out); p = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", out)
print(V, "audio done; integrated", m[-1] if m else "?", "LUFS; true peak", p[-1] if p else "?", "dBFS; total", total)
