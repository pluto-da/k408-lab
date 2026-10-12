import json, subprocess, sys
ls = sys.argv[1] if len(sys.argv)>1 else "0.88"
d = json.load(open("narration.json"))
seen = {}
for ver in ("v","h"):
    for sid, text, _ in d[ver]:
        out = f"tts/{sid}.wav"
        subprocess.run(["python3","-m","piper","-m","voices/zh_CN-huayan-medium.onnx","-f",out,"--length-scale",ls,"--sentence-silence","0.12","--noise-scale","0.6","--noise-w-scale","0.75"], input=text.encode(), check=True, capture_output=True)
        dur = float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",out]).decode())
        print(sid, round(dur,2), len(text))
