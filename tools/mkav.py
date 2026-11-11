from PIL import Image, ImageDraw
import math
S=240
COL=[((229,9,20),(120,0,30)),((255,176,46),(200,80,0)),((46,204,113),(10,110,70)),((52,152,219),(20,60,140)),
     ((155,89,182),(70,30,110)),((241,196,15),(190,120,0)),((26,188,156),(8,90,90)),((231,76,60),(140,30,70)),
     ((236,64,122),(120,20,80)),((0,184,212),(0,80,140)),((124,179,66),(40,90,30)),((255,112,67),(170,40,20)),
     ((92,107,192),(30,40,110)),((96,125,139),(30,45,55)),((255,64,129),(100,30,160)),((0,150,136),(20,50,90))]
def bg(c1,c2):
    im=Image.new('RGB',(S,S)); d=ImageDraw.Draw(im)
    for y in range(S):
        t=y/S; d.line([(0,y),(S,y)],fill=tuple(int(c1[i]*(1-t)+c2[i]*t) for i in range(3)))
    return im
def face(d,style):
    W=(255,255,255); K=(20,20,30)
    if style in (0,4,8,12):  # classic smile
        d.ellipse((70,80,95,110),fill=W); d.ellipse((145,80,170,110),fill=W)
        d.arc((70,110,170,180),20,160,fill=W,width=10)
    elif style in (1,5,9,13): # wink + big grin
        d.ellipse((70,85,96,111),fill=W); d.line((142,98,172,98),fill=W,width=9)
        d.chord((70,120,170,190),0,180,fill=W)
    elif style in (2,6,10,14): # sunglasses
        d.rounded_rectangle((55,80,115,115),12,fill=K); d.rounded_rectangle((125,80,185,115),12,fill=K); d.line((110,92,130,92),fill=K,width=6)
        d.arc((85,125,155,175),20,160,fill=W,width=9)
    else: # robot / alien-ish
        d.rounded_rectangle((60,70,180,130),20,outline=W,width=8); d.ellipse((80,88,104,112),fill=W); d.ellipse((136,88,160,112),fill=W)
        d.rectangle((90,150,150,165),fill=W); d.line((120,30,120,70),fill=W,width=6); d.ellipse((110,20,130,40),fill=W)
for i,(c1,c2) in enumerate(COL):
    im=bg(c1,c2); d=ImageDraw.Draw(im)
    # decorative shapes
    if i%4==0: d.ellipse((150,-40,300,110),fill=tuple(min(255,v+40) for v in c1))
    if i%4==1: d.polygon([(0,240),(0,170),(90,240)],fill=tuple(min(255,v+40) for v in c1))
    if i%4==2: d.ellipse((-60,150,80,290),fill=tuple(max(0,v-40) for v in c2))
    face(d,i)
    m=Image.new('L',(S,S),0); ImageDraw.Draw(m).rounded_rectangle((0,0,S-1,S-1),36,fill=255)
    out=Image.new('RGBA',(S,S)); out.paste(im,(0,0),m); out.save('app/img/av/%d.png'%i)
g=Image.new('RGB',(S*8+70,S*2+30),(15,15,20))
for i in range(16): g.paste(Image.open('app/img/av/%d.png'%i),(10+(i%8)*(S+8),10+(i//8)*(S+10)),Image.open('app/img/av/%d.png'%i))
g.save('shots/avatars.png')
