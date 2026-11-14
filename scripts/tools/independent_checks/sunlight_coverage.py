"""Independent check written by AI on 14 Nov 2026 (ninja's instruction). Shares no code with scripts/*.py or app/src/geometry.
Run from the repo root with the venv; raw data from $CLPS_DATA. Results: docs/event/validation.md, "Independent recomputation".
"""
import os
# Independent sunlight / station coverage from SPICE kernels directly (not the shipped ephemeris JSON, not app code), 1-minute step.
import json, math, sys, numpy as np, spiceypy as sp
K=os.environ['CLPS_DATA']+'/spice/'
for f in ['de440s.bsp','moon_de440_250416.tf','moon_pa_de440_200625.bpc','naif0012.tls','pck00011.tpc']: sp.furnsh(K+f)
D='app/public/data/'
sites=(lambda j: j if isinstance(j,list) else j['sites'])(json.load(open(D+'sites.json')))
stations=json.load(open(D+'stations.json'))
start,days=sys.argv[1],int(sys.argv[2])
et0=sp.str2et(start); n=days*1440
ets=et0+60.0*np.arange(n)
RM=1737.4; A=6378.137; F=1/298.257223563
def ef(st):
    la,lo=math.radians(st['lat_deg']),math.radians(st['lon_deg']); e2=F*(2-F); N=A/math.sqrt(1-e2*math.sin(la)**2); h=st['h_m']/1000
    return np.array([(N+h)*math.cos(la)*math.cos(lo),(N+h)*math.cos(la)*math.sin(lo),(N*(1-e2)+h)*math.sin(la)]), np.array([math.cos(la)*math.cos(lo),math.cos(la)*math.sin(lo),math.sin(la)])
sun=np.empty((n,3)); earth=np.empty((n,3)); Rm=np.empty((n,3,3))
for i,et in enumerate(ets):
    sun[i],_=sp.spkpos('SUN',et,'MOON_ME','LT+S','MOON'); earth[i],lt=sp.spkpos('EARTH',et,'MOON_ME','LT+S','MOON')
    Rm[i]=sp.pxfrm2('IAU_EARTH','MOON_ME',et-lt,et)
def azel(v,up,east,north):
    u=v/np.linalg.norm(v,axis=1)[:,None]; return np.degrees(np.arctan2(u@east,u@north))%360, np.degrees(np.arcsin(u@up)), np.linalg.norm(v,axis=1)
res={}
for s in sites:
    try: hz=json.load(open(D+f"horizons/{s['id']}.json"))
    except FileNotFoundError: continue
    m=np.array(hz['mask']); st=hz['az_step']
    mask=lambda az: np.interp(az, np.arange(len(m)+1)*st, np.append(m,m[0]))
    la,lo=math.radians(s['lat']),math.radians(s['lon'])
    up=np.array([math.cos(la)*math.cos(lo),math.cos(la)*math.sin(lo),math.sin(la)]); east=np.cross([0,0,1],up); east/=np.linalg.norm(east); north=np.cross(up,east)
    O=(RM+(s['elev_m']+1.75)/1000)*up
    az,el,dist=azel(sun-O,up,east,north); lit=el+np.degrees(np.arcsin(695700/dist))>mask(az)
    az,el,dist=azel(earth-O,up,east,north); ev=el+np.degrees(np.arcsin(6371.0/dist))>mask(az)
    cov=np.zeros(n,bool)
    for stn in stations:
        p,nu=ef(stn); sme=earth+np.einsum('nij,j->ni',Rm,p)
        az,el,_=azel(sme-O,up,east,north); terr=el>mask(az)
        vef=np.einsum('nji,nj->ni',Rm,O-earth)-p; mel=np.degrees(np.arcsin((vef/np.linalg.norm(vef,axis=1)[:,None])@nu))
        cov|=terr&(mel>=stn['min_elev_deg'])
    def longest(b):
        best=cur=0
        for x in b:
            cur=cur+1 if x else 0; best=max(best,cur)
        return best/60
    res[s['id']]=dict(lit=round(100*lit.mean(),1),earth=round(100*ev.mean(),1),cov=round(100*cov.mean(),1),dark_h=round(longest(~lit),1),gap_h=round(longest(~cov),1))
    print(s['id'],res[s['id']])
json.dump(res,open(sys.argv[3],'w'))
