import asyncio, base64, os, subprocess, sys, shutil
from playwright.async_api import async_playwright
APP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "app")
OUT = sys.argv[2] if len(sys.argv) > 2 else "dist/mini_preview.mp4"
FPS, LEN = 30, 2.4
TMP = "/tmp/mini_frames"; shutil.rmtree(TMP, ignore_errors=True); os.makedirs(TMP)
html = f"""<!doctype html><html><head><meta charset=utf-8><link rel=stylesheet href="file://{APP}/css/style.css">
<style>html,body{{margin:0;width:1920px;height:1080px;background:#000;overflow:hidden}}</style></head><body>
<script>window.NFI_PREVIEW=1;</script><script src="file://{APP}/js/intro.js"></script><script src="file://{APP}/js/mini.js"></script></body></html>"""
open(f"{APP}/_preview.html", "w").write(html)
WAV_JS = """async () => {
 const sr=48000, ctx=new OfflineAudioContext(2, Math.ceil(sr*%f), sr);
 miniSynth(ctx, ctx.destination, 0.0);
 const b=await ctx.startRendering(); const n=b.length, L=b.getChannelData(0), R=b.getChannelData(1);
 let peak=0; for(let i=0;i<n;i++){peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));}
 const buf=new ArrayBuffer(44+n*4), v=new DataView(buf); const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 w(0,'RIFF');v.setUint32(4,36+n*4,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
 v.setUint32(24,sr,true);v.setUint32(28,sr*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*4,true);
 let o=44; for(let i=0;i<n;i++){for(const c of [L,R]){const s=Math.max(-1,Math.min(1,c[i]));v.setInt16(o,s*32767,true);o+=2;}}
 let bin='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i+=32768)bin+=String.fromCharCode.apply(null,u.subarray(i,i+32768));
 return [btoa(bin), peak];
}""" % LEN
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"),
                                     args=["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"])
        pg = await br.new_page(viewport={"width": 1920, "height": 1080})
        await pg.goto(f"file://{APP}/_preview.html"); await pg.wait_for_timeout(500)
        b64, peak = await pg.evaluate(WAV_JS)
        open("/tmp/mini.wav", "wb").write(base64.b64decode(b64)); print("audio peak", round(peak, 3))
        await pg.evaluate("playMini({silent:true,noEnd:true})")
        await pg.wait_for_timeout(300)
        await pg.evaluate("document.getAnimations().forEach(a=>a.pause())")
        n = int(FPS * LEN)
        for i in range(n):
            t = i * 1000.0 / FPS
            await pg.evaluate(f"document.getAnimations().forEach(a=>{{a.currentTime={t};}})")
            await pg.screenshot(path=f"{TMP}/f{i:04d}.png")
        print("frames", n, "anims", await pg.evaluate("document.getAnimations().length"))
        await br.close()
    os.remove(f"{APP}/_preview.html")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{TMP}/f%04d.png", "-i", "/tmp/mini.wav",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-shortest", OUT], check=True)
    print("wrote", OUT)
asyncio.run(main())
