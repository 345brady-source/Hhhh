import sys; sys.path.insert(0, sys.argv[0].rsplit('/',1)[0])
from lib import Doc
d=Doc(sys.argv[1])
for n in [int(x) for x in sys.argv[2].split(',')]:
    print('===== page',n); d.dump(n)
