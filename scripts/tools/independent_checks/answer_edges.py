"""Independent check written by AI on 14 Nov 2026 (ninja's instruction). Shares no code with scripts/*.py or app/src/geometry.
Run from the repo root with the venv; raw data from $CLPS_DATA. Results: docs/event/validation.md, "Independent recomputation".
"""
import os
import json, math, numpy as np, spiceypy as sp
K=os.environ['CLPS_DATA']+'/spice/'
for f in ['de440s.bsp','moon_de440_250416.tf','moon_pa_de440_200625.bpc','naif0012.tls','pck00011.tpc']: sp.furnsh(K+f)
D='app/public/data/'
sites={s['id']:s for s in (lambda j: j if isinstance(j,list) else j['sites'])(json.load(open(D+'sites.json')))}
stations=json.load(open(D+'stations.json'))
A=6378.137; F=1/298.257223563
def state(sid,et):
    s=sites[sid]; hz=json.load(open(D+f"horizons/{sid}.json")); m=np.array(hz['mask'])
    mask=lambda az: float(np.interp(az%360, np.arange(len(m)+1)*hz['az_step'], np.append(m,m[0])))
    la,lo=math.radians(s['lat']),math.radians(s['lon'])
    up=np.array([math.cos(la)*math.cos(lo),math.cos(la)*math.sin(lo),math.sin(la)]); east=np.cross([0,0,1],up); east/=np.linalg.norm(east); north=np.cross(up,east)
    O=(1737.4+(s['elev_m']+1.75)/1000)*up
    def ae(v):
        d=np.linalg.norm(v); u=v/d; return math.degrees(math.atan2(u@east,u@north))%360, math.degrees(math.asin(u@up)), d
    sun,_=sp.spkpos('SUN',et,'MOON_ME','LT+S','MOON'); earth,lt=sp.spkpos('EARTH',et,'MOON_ME','LT+S','MOON'); R=np.array(sp.pxfrm2('IAU_EARTH','MOON_ME',et-lt,et))
    az,el,d=ae(sun-O); lit=el+math.degrees(math.asin(695700/d))>mask(az)
    cov=False
    for st in stations:
        a,o=math.radians(st['lat_deg']),math.radians(st['lon_deg']); e2=F*(2-F); N=A/math.sqrt(1-e2*math.sin(a)**2); h=st['h_m']/1000
        p=np.array([(N+h)*math.cos(a)*math.cos(o),(N+h)*math.cos(a)*math.sin(o),(N*(1-e2)+h)*math.sin(a)]); nu=np.array([math.cos(a)*math.cos(o),math.cos(a)*math.sin(o),math.sin(a)])
        az2,el2,_=ae(earth+R@p-O); v=R.T@(O-earth)-p
        if el2>mask(az2) and math.degrees(math.asin((v/np.linalg.norm(v))@nu))>=st['min_elev_deg']: cov=True
    return lit,cov,(az,el)
def nextchange(sid,start,end,idx):
    et=sp.str2et(start); e1=sp.str2et(end); v0=state(sid,et)[idx]; t=et
    while t<e1:
        t+=60
        if state(sid,t)[idx]!=v0: return v0,(t-et)/3600
    return v0,None
print('Malapert 2030-06-01 00:00 sun:',nextchange('malapert-massif','2030-06-01T00:00','2030-06-15T00:00',0),' app: "Dark for 31 more hours"')
print('Malapert 2030-06-01 00:00 comms:',nextchange('malapert-massif','2030-06-01T00:00','2030-06-15T00:00',1),' app: "Station contact for 3 more days"')
print('Haworth 2029-02-17 06:30 sun:',nextchange('haworth','2029-02-17T06:30','2029-03-02T00:00',0),' app: "Dark until the end of this period"')
print('Haworth 2029-02-17 06:30 comms:',nextchange('haworth','2029-02-17T06:30','2029-03-02T00:00',1),' app: "Station contact for 5 more days"')
print('Connecting Ridge 2027-08-28 11:30 sun:',nextchange('connecting-ridge','2027-08-28T11:30','2027-08-30T00:00',0),' app screenshot: "Sunlight for 7 more hours"')
print('Connecting Ridge 2027-08-19 16:00 sun:',nextchange('connecting-ridge','2027-08-19T16:00','2027-08-30T00:00',0),' app screenshot: "Sunlight for 9 more days"')
# V2: Sun elevation at the south pole ~ -subsolar latitude... at lat -89.999 on the sphere
et=sp.str2et('2027-08-20T12:00'); sun,_=sp.spkpos('SUN',et,'MOON_ME','LT+S','MOON'); sublat=math.degrees(math.asin(sun[2]/np.linalg.norm(sun)))
print('V2: subsolar latitude',round(sublat,4),'-> Sun elevation at the south pole should be',round(-sublat,4))
# V3: flat-sphere dip for 1.75 m
print('V3: dip', -math.degrees(math.acos(1737.4/(1737.4+0.00175))))
