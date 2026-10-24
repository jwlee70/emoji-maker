# 배경 제거 모델(isnet_quint8)과 onnxruntime wasm 파일을 imgly CDN에서 받아 docs/vendor/bgr 에 저장
import json, os, urllib.request
opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", "Mozilla/5.0")]
urllib.request.install_opener(opener)
VER = "1.7.0"
BASE = f"https://staticimgly.com/@imgly/background-removal-data/{VER}/dist/"
KEEP = ["/models/isnet_quint8", "/onnxruntime-web/ort-wasm-simd-threaded.wasm",
        "/onnxruntime-web/ort-wasm-simd-threaded.mjs"]
OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "vendor", "bgr")
os.makedirs(OUT, exist_ok=True)
res = json.load(urllib.request.urlopen(BASE + "resources.json"))
res = {k: v for k, v in res.items() if k in KEEP}
for v in res.values():
    for c in v["chunks"]:
        p = os.path.join(OUT, c["name"])
        if not os.path.exists(p):
            urllib.request.urlretrieve(BASE + c["name"], p)
            print("got", c["name"])
json.dump(res, open(os.path.join(OUT, "resources.json"), "w"), indent=1)
