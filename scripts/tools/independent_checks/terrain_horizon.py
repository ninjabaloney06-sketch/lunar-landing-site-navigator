"""Independent check written by AI on 14 Nov 2026 (ninja's instruction). Shares no code with scripts/*.py or app/src/geometry.
Run from the repo root with the venv; raw data from $CLPS_DATA. Results: docs/event/validation.md, "Independent recomputation".
"""
import os
# Independent horizon recomputation (own projection, own stepping, bilinear, 20 m near + 120 m far). Not using scripts/horizon.py.
import json, math, sys, numpy as np, rasterio
from rasterio.windows import Window
from scipy.ndimage import map_coordinates
R=1737400.0
L=os.environ['CLPS_DATA']+'/lola/'
HZ='/Users/Guest123/Documents/clps-lunar-mission-browser/app/public/data/horizons/'
far_ds=rasterio.open(L+'LDEM_60S_120MPP_ADJ.TIF'); far=far_ds.read(1); FT=far_ds.transform
near_ds=rasterio.open(L+'LDEM_80S_20MPP_ADJ.TIF'); NT=near_ds.transform
def xy(lat,lon):  # south polar stereographic on the sphere, lat/lon in rad
    rho=2*R*np.tan(np.pi/4+lat/2); return rho*np.sin(lon), rho*np.cos(lon)
def samp(arr,T,x,y,c0=0,r0=0):
    col=(x-T.c)/T.a-0.5-c0; row=(y-T.f)/T.e-0.5-r0
    return map_coordinates(arr,[row,col],order=1,mode='constant',cval=np.nan)
def run(sid, azs):
    h=json.load(open(HZ+sid+'.json')); lat,lon=math.radians(h['lat']),math.radians(h['lon'])
    x0,y0=xy(lat,lon); c=int((x0-NT.c)/NT.a); r=int((y0-NT.f)/NT.e); half=1100
    c0,r0=max(c-half,0),max(r-half,0)
    win=near_ds.read(1,window=Window(c0,r0,min(2*half,30400-c0),min(2*half,30400-r0)))
    h0=float(samp(win,NT,np.array([x0]),np.array([y0]),c0,r0)[0])
    up=np.array([math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat)])
    O=(R+h0+1.75)*up
    d=np.concatenate([np.arange(20,20000,20.0),np.arange(20000,300001,100.0)])
    out=[]
    for az in azs:
        a=math.radians(az); delta=d/R
        la=np.arcsin(np.sin(lat)*np.cos(delta)+np.cos(lat)*np.sin(delta)*math.cos(a))
        lo=lon+np.arctan2(math.sin(a)*np.sin(delta)*np.cos(lat),np.cos(delta)-np.sin(lat)*np.sin(la))
        x,y=xy(la,lo)
        hh=np.where(d<20000, samp(win,NT,x,y,c0,r0), np.nan)
        hf=samp(far,FT,x,y); hh=np.where(np.isnan(hh),hf,hh)
        P=(R+hh)[:,None]*np.stack([np.cos(la)*np.cos(lo),np.cos(la)*np.sin(lo),np.sin(la)],1)
        v=P-O; el=np.degrees(np.arcsin((v@up)/np.linalg.norm(v,axis=1)))
        k=np.nanargmax(el); out.append((az,float(el[k]),d[k]/1000,int(np.isnan(hh).sum())))
    m=np.array(h['mask']); step=h['az_step']
    diffs=[(az,el-m[int(round(az/step))%len(m)],el,m[int(round(az/step))%len(m)],dk,nn) for az,el,dk,nn in out]
    dd=np.array([x[1] for x in diffs])
    print(f"{sid}: site height DEM {h0:.1f} m (file {h['elev_m']}), {len(azs)} azimuths: median |diff| {np.median(abs(dd)):.4f}°, 95th {np.percentile(abs(dd),95):.4f}°, max {abs(dd).max():.4f}°, mean signed {dd.mean():+.4f}°")
    for az,df,el,mk,dk,nn in sorted(diffs,key=lambda t:-abs(t[1]))[:4]: print(f"   az {az:6.1f}: mine {el:7.3f} shipped {mk:7.3f} diff {df:+.3f} (my max at {dk:.1f} km, nodata samples {nn})")
    return diffs
for sid in sys.argv[1:]:
    run(sid, np.arange(0,360,2.5))
print('IM-1 azimuths 8.5-34 (the directions that changed at regeneration):'); run('im-1', np.arange(8.5,34.01,0.5))
