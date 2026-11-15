import sys,re,pypdf
r=pypdf.PdfReader(sys.argv[1])
for i,p in enumerate(r.pages,1):
    c=p.get_contents().get_data().decode('latin1')
    ops=re.findall(r'([-\d\.\s]+)\s+cm|(/\w+)\s+Do|([-\d\.\s]+)\s+re\s+W',c)
    out=[]
    for a,b,w in ops:
        if a: out.append('cm '+' '.join(a.split()[-6:]))
        if b: out.append('Do '+b)
        if w: out.append('clip '+' '.join(w.split()[-4:]))
    print(i,p.mediabox, [o for o in out if o][:40])
