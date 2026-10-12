# Original background music synthesized with numpy (no samples): light electronic + piano ambience, 116 BPM, C major.
# usage: python3 music.py <seconds> <out.wav>
import sys, numpy as np, wave
SR = 48000
dur = float(sys.argv[1]); out = sys.argv[2]
BPM = 116.0; beat = 60 / BPM; bar = 4 * beat
N = int(SR * (dur + 2.5))
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(408)

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def add(sig, t0, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if i >= N: return
    s = sig[: N - i] * gain
    L[i:i + len(s)] += s * np.sqrt(0.5 * (1 - pan)) * 1.414 / 2 * 2 ** 0.5
    R[i:i + len(s)] += s * np.sqrt(0.5 * (1 + pan)) * 1.414 / 2 * 2 ** 0.5

def env_adsr(n, a, d, s, r, sus_len):
    a, d, r = int(a * SR), int(d * SR), int(r * SR); sl = max(0, int(sus_len * SR) - a - d)
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(sl, s), np.linspace(s, 0, max(r, 1))])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))

def piano(m, length=1.6, vel=1.0):
    n = int(SR * length); t = np.arange(n) / SR; f = midi(m)
    s = np.zeros(n)
    for k, amp in enumerate([1.0, 0.45, 0.25, 0.12, 0.06], start=1):
        s += amp * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * (2.2 + 1.3 * k))
    s *= np.minimum(1, t / 0.004)
    return s * vel * 0.22

def pluck(m, length=0.45, vel=1.0):
    n = int(SR * length); t = np.arange(n) / SR; f = midi(m)
    s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sign(np.sin(2 * np.pi * f * t))) * np.exp(-t * 9)
    return s * np.minimum(1, t / 0.003) * vel * 0.10

def pad(ms, length):
    n = int(SR * length); t = np.arange(n) / SR; s = np.zeros(n)
    for m in ms:
        for det in (-0.12, 0.0, 0.11):
            f = midi(m) * 2 ** (det / 12)
            ph = rng.uniform(0, 2 * np.pi)
            s += np.sin(2 * np.pi * f * t + ph) + 0.25 * np.sin(2 * np.pi * 2 * f * t + ph)
    s /= (len(ms) * 3)
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t)
    return s * env_adsr(n, 0.6, 0.4, 0.8, 0.9, length - 0.9) * lfo * 0.16

def kick():
    n = int(SR * 0.35); t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * 0.55

def hat(open_=False):
    n = int(SR * (0.18 if open_ else 0.05)); t = np.arange(n) / SR
    s = rng.standard_normal(n); s = np.diff(np.concatenate([[0], s]))  # crude high-pass
    return s * np.exp(-t * (18 if open_ else 70)) * 0.05

def clap():
    n = int(SR * 0.2); t = np.arange(n) / SR
    s = rng.standard_normal(n) * (np.exp(-t * 25) + 0.6 * np.exp(-((t - 0.012) * 300) ** 2))
    return np.diff(np.concatenate([[0], s])) * 0.10

# progression C - G - Am - F  (I V vi IV), voiced around middle C
prog = [(48, [60, 64, 67, 72]), (43, [59, 62, 67, 71]), (45, [60, 64, 69, 72]), (41, [60, 65, 69, 72])]
nbars = int(np.ceil(dur / bar))
for b in range(nbars):
    t0 = b * bar
    root, ch = prog[b % 4]
    sec = b / max(nbars - 1, 1)
    last = b == nbars - 1
    # pad always
    add(pad([m - 12 for m in ch[:3]] + [ch[3]], bar + (2.0 if last else 0.3)), t0, 0.0, 1.0)
    # bass on 1 and the "and" of 2
    for off, vel in ((0, 1.0), (1.5 * beat, 0.7), (2 * beat, 0.9), (3.5 * beat, 0.6)):
        if last and off > 0: break
        n = int(SR * 0.5); t = np.arange(n) / SR
        f = midi(root - 12 + 12)
        bs = (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 4) * np.minimum(1, t / 0.005)
        add(bs * 0.22 * vel, t0 + off)
    # piano chord on beat 1 (and beat 3 softly)
    for m in ch:
        add(piano(m, 2.4 if last else 1.6, 0.9), t0 + rng.uniform(0, 0.012), -0.2)
        if not last: add(piano(m, 1.2, 0.45), t0 + 2 * beat + rng.uniform(0, 0.01), -0.2)
    if last: continue
    # arpeggio 16ths after the intro bar
    if b >= 1:
        arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[3] + 12, ch[2] + 24]
        for k in range(16):
            add(pluck(arp[k % 8], 0.4, 0.8 if k % 4 == 0 else 0.55), t0 + k * beat / 4, 0.35 if k % 2 else -0.1)
    # drums from bar 1
    if b >= 1:
        for k in range(4):
            add(kick(), t0 + k * beat, 0.0, 1.0 if k % 2 == 0 else 0.8)
            add(hat(), t0 + k * beat + beat / 2, 0.3)
            if b >= 2: add(hat(), t0 + k * beat + beat / 4, -0.3, 0.6); add(hat(), t0 + k * beat + 3 * beat / 4, -0.3, 0.6)
        if b >= 2:
            add(clap(), t0 + beat, 0.1); add(clap(), t0 + 3 * beat, 0.1)
    # intro riser hit at t=0 : a bright bell
    if b == 0:
        for m in (84, 91, 96):
            add(piano(m, 2.0, 0.6), 0.0, 0.2)

# simple stereo delay on everything for space
d = int(SR * beat * 0.75)
L2 = L.copy(); R2 = R.copy()
L2[d:] += 0.18 * R[:-d]; R2[d:] += 0.18 * L[:-d]
# trim to dur + tail, fade out last 1.5s
M = int(SR * (dur + 0.0))
x = np.stack([L2[:M], R2[:M]], 1)
fade = int(SR * 1.8); x[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
x /= np.max(np.abs(x)) * 1.12
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x * 32767).astype(np.int16).tobytes())
print("ok", out, dur)
