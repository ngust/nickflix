from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
F='tools/fonts/Anton-Regular.ttf'
def grad(w,h,stops):
    g=Image.new('RGBA',(w,h))
    px=g.load()
    for y in range(h):
        t=y/(h-1)
        for i in range(len(stops)-1):
            t0,c0=stops[i];t1,c1=stops[i+1]
            if t0<=t<=t1:
                f=(t-t0)/(t1-t0) if t1>t0 else 0
                c=tuple(int(c0[k]+(c1[k]-c0[k])*f) for k in range(3));break
        for x in range(w): px[x,y]=c+(255,)
    return g
STOPS=[(0,(255,226,122)),(0.30,(255,170,40)),(0.62,(236,28,36)),(1,(130,0,16))]
def wordmark(text,size,pad=30):
    font=ImageFont.truetype(F,size)
    bb=font.getbbox(text)
    w=bb[2]-bb[0]+pad*2; h=bb[3]-bb[1]+pad*2+int(size*0.18)
    mask=Image.new('L',(w,h),0); d=ImageDraw.Draw(mask)
    d.text((pad-bb[0],pad-bb[1]),text,font=font,fill=255)
    # swoosh underline (gold arc under the letters)
    sw=Image.new('L',(w,h),0); ds=ImageDraw.Draw(sw)
    y0=pad+(bb[3]-bb[1])+int(size*0.05)
    ds.ellipse((pad, y0-int(size*0.9), w-pad, y0+int(size*0.10)), outline=255, width=max(4,int(size*0.06)))
    sw=sw.crop((0,y0-int(size*0.02),w,h)); swfull=Image.new('L',(w,h),0); swfull.paste(sw,(0,y0-int(size*0.02)))
    # keep only lower part of ellipse
    out=Image.new('RGBA',(w,h),(0,0,0,0))
    shadow=Image.new('RGBA',(w,h),(0,0,0,0)); shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(size*0.04)).point(lambda v:int(v*0.8)))
    out=Image.alpha_composite(out,shadow)
    g=grad(w,h,STOPS); g.putalpha(mask)
    out=Image.alpha_composite(out,g)
    gold=grad(w,h,[(0,(255,236,150)),(1,(255,160,30))]); gold.putalpha(swfull)
    out=Image.alpha_composite(out,gold)
    return out.crop(out.getbbox())
wm=wordmark('NICKFLIX',220); wm.save('app/img/logo.png'); print('logo',wm.size)
# icon
S=512
bg=Image.new('RGBA',(S,S),(0,0,0,255)); d=ImageDraw.Draw(bg)
for r in range(S//2+120,0,-4):
    t=r/(S//2+120); c=(int(70*(1-t)+8*t),int(4*(1-t)),int(10*(1-t)+6*t))
    d.ellipse((S/2-r,S/2-r-40,S/2+r,S/2+r-40),fill=c+(255,))
font=ImageFont.truetype(F,320)
mask=Image.new('L',(S,S),0); dm=ImageDraw.Draw(mask)
bb=font.getbbox('N'); x=(S-(bb[2]-bb[0]))//2-bb[0]; y=(S-(bb[3]-bb[1]))//2-bb[1]-62
dm.text((x,y),'N',font=font,fill=255)
fs=ImageFont.truetype(F,110); bf=fs.getbbox('FLIX')
fm=Image.new('L',(S,S),0); ImageDraw.Draw(fm).text(((S-(bf[2]-bf[0]))//2-bf[0], 388-bf[1]),'FLIX',font=fs,fill=255)
sh=Image.new('RGBA',(S,S),(0,0,0,0)); sh.putalpha(mask.filter(ImageFilter.GaussianBlur(14)))
bg=Image.alpha_composite(bg,sh)
g=grad(S,S,[(0,(255,226,122)),(0.25,(255,170,40)),(0.55,(236,28,36)),(0.78,(130,0,16)),(1,(130,0,16))]); g.putalpha(mask); bg=Image.alpha_composite(bg,g)
gold=Image.new('RGBA',(S,S),(255,200,70,255)); gold.putalpha(fm); bg=Image.alpha_composite(bg,gold)
# rounded corners
rm=Image.new('L',(S,S),0); ImageDraw.Draw(rm).rounded_rectangle((0,0,S-1,S-1),radius=96,fill=255)
bg.putalpha(rm); bg.save('app/img/icon.png'); print('icon ok')
# preview
pv=Image.new('RGBA',(1400,700),(14,14,18,255)); pv.alpha_composite(wm,(40,60)); pv.alpha_composite(bg,(860,150)); pv.convert('RGB').save('preview.png')
