# Keep the downloads following the walkers: regenerate the picture, Regulation A (PDF and picture) and PDF candidate
# lists from what the walkers and searches have found, download what is new, repeat until the walkers stop.
import subprocess, time, os
S = os.path.dirname(os.path.abspath(__file__)); W = os.path.dirname(S)
def running(name):
    return subprocess.run(['pgrep', '-f', name], capture_output=True).returncode == 0
def py(*a):
    subprocess.run(['python3', '-I'] + list(a), stdout=open(W + '/cycle.log', 'a'), stderr=subprocess.STDOUT)
while True:
    live = running('picwalk.py') or running('regawalk.py') or running('pdfsearch.py')
    py(S + '/cands_pic.py'); py(S + '/dl.py', W + '/cand_pic.json', W + '/dl_pic.jsonl')
    py(S + '/cands_rega.py', 'pic'); py(S + '/dl.py', W + '/cand_rega.json', W + '/dl_rega.jsonl')
    py(S + '/cands_pdfs.py'); py(S + '/dl.py', W + '/cand_pdfs.json', W + '/dl_pdf.jsonl')
    if not live: break
    time.sleep(60)
