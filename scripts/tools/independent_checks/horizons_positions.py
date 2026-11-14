"""Independent check written by AI on 14 Nov 2026 (ninja's instruction). Shares no code with scripts/*.py or app/src/geometry.
Run from the repo root with the venv; raw data from $CLPS_DATA. Results: docs/event/validation.md, "Independent recomputation".
"""
import os
import json, math, subprocess, urllib.parse, sys, datetime as dt
R=1737.4
D='app/public/data/'
sites={s['id']:s for s in (lambda j: j if isinstance(j,list) else j['sites'])(json.load(open(D+'sites.json')))}
def ours(site,t,body):
    e=json.load(open(D+f"ephem/{t:%Y-%m}.json"))
    t0=dt.datetime.fromisoformat(e['start_utc'].replace('Z','+00:00'))
    k=(t-t0).total_seconds()/60/e['step_min']; assert k==int(k); k=int(k)
    b=e[body+'_km'][k]
    la,lo=math.radians(site['lat']),math.radians(site['lon'])
    up=(math.cos(la)*math.cos(lo),math.cos(la)*math.sin(lo),math.sin(la))
    r=R+(site['elev_m']+1.75)/1000
    d=[b[i]-r*up[i] for i in range(3)]
    n=math.sqrt(sum(x*x for x in d)); u=[x/n for x in d]
    # east = z x up, north = up x east
    ex,ey=-up[1],up[0]; m=math.hypot(ex,ey); east=(ex/m,ey/m,0)
    north=(up[1]*east[2]-up[2]*east[1], up[2]*east[0]-up[0]*east[2], up[0]*east[1]-up[1]*east[0])
    dot=lambda a,b:sum(x*y for x,y in zip(a,b))
    E,N,Z=dot(u,east),dot(u,north),dot(u,up)
    return math.degrees(math.atan2(E,N))%360, math.degrees(math.atan2(Z,math.hypot(E,N)))
def horizons(site,t,cmd):
    p={'format':'text','COMMAND':f"'{cmd}'",'OBJ_DATA':'NO','MAKE_EPHEM':'YES','EPHEM_TYPE':'OBSERVER','CENTER':"'coord@301'",'COORD_TYPE':'GEODETIC',
       'SITE_COORD':f"'{site['lon']%360},{site['lat']},{(site['elev_m']+1.75)/1000}'",'TLIST':f"'{t:%Y-%m-%d %H:%M}'",'TLIST_TYPE':'CAL','TIME_TYPE':'UT','QUANTITIES':"'4'",'APPARENT':'AIRLESS','ANG_FORMAT':'DEG','CSV_FORMAT':'YES'}
    url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(p)
    out=subprocess.run(['curl','-s','--max-time','60',url],capture_output=True,text=True).stdout
    try:
        line=out.split('$$SOE')[1].split('$$EOE')[0].strip().split(',')
        nums=[float(x) for x in line[1:] if x.strip().replace('.','').replace('-','').isdigit()]
        return nums[0],nums[1]
    except Exception as ex:
        print(out[-1500:]); raise
cases=[('connecting-ridge','2027-08-20T12:00'),('connecting-ridge','2027-08-28T11:30'),('connecting-ridge','2030-06-10T00:00'),
       ('malapert-massif','2026-12-05T06:00'),('malapert-massif','2028-01-15T18:30'),('im-1','2027-03-03T03:00'),('im-1','2029-09-21T21:00'),
       ('haworth','2029-02-17T06:30'),('haworth','2027-08-16T00:00'),('malapert-massif','2030-06-01T00:00')]
worst=0
for sid,ts in cases:
    t=dt.datetime.fromisoformat(ts+':00+00:00'); s=sites[sid]
    for body,cmd in(('sun','10'),('earth','399')):
        a,e=ours(s,t,body); ha,he=horizons(s,t,cmd)
        daz=((a-ha+180)%360-180)*math.cos(math.radians(e)); de=e-he
        worst=max(worst,abs(daz),abs(de))
        print(f"{sid:18s} {ts} {body:5s} ours az {a:8.3f} el {e:7.3f} | JPL az {ha:8.3f} el {he:7.3f} | d_az*cos(el) {daz:+.4f} d_el {de:+.4f}")
print('worst',round(worst,4))
