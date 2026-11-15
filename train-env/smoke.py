"""End-to-end smoke test of the training environment (scratch only, never shipped).

  SCRATCH/train/venv/bin/python -I SCRATCH/train/smoke.py

1. Builds the probe network of research-ort-scripts/make_fcn.py in torch (same layers, same 257,318 parameters,
   1 input channel, 6 output maps at quarter size), trains it 20 steps on random tensors on CPU.
2. Exports it to ONNX with opset 17 (as make_fcn.py), checks the model, runs the same input through onnxruntime
   and checks the largest absolute difference against torch is at most 1e-4.
3. Fits scikit-learn HistGradientBoostingClassifier on 2,000 random rows with 3 classes and checks that
   predict_proba sums to 1 on every row.
Last line: "SMOKE: PASS" or "SMOKE: FAIL - <step>".
"""
import os
import sys
import tempfile
import traceback

H, W = 256, 192  # divisible by 16, as the network needs
EXPECTED_PARAMS = 257318  # make_fcn.py: e1..e4, m1, m2, u1, d1, head
TOL = 1e-4


def fail(step):
    traceback.print_exc()
    print(f"SMOKE: FAIL - {step}")
    sys.exit(1)


try:
    import numpy as np
    import torch
    import torch.nn as nn
    import onnx
    import onnxruntime as ort
    from sklearn.ensemble import HistGradientBoostingClassifier
except Exception:
    fail("import")


class Places(nn.Module):
    """The make_fcn.py probe network, layer for layer."""

    def __init__(self):
        super().__init__()
        c = lambda i, o, k, s: nn.Conv2d(i, o, k, stride=s, padding=k // 2)
        self.e1, self.e2, self.e3, self.e4 = c(1, 16, 3, 2), c(16, 32, 3, 2), c(32, 64, 3, 2), c(64, 96, 3, 2)
        self.m1, self.m2 = c(96, 96, 3, 1), c(96, 96, 3, 1)
        self.u1 = c(96, 32, 1, 1)
        self.d1 = c(32, 32, 3, 1)
        self.head = c(32, 6, 1, 1)
        self.up = nn.Upsample(scale_factor=4, mode="nearest")

    def forward(self, page):
        r = torch.relu
        a = r(self.e1(page))           # 1/2
        b = r(self.e2(a))              # 1/4
        d = r(self.e4(r(self.e3(b))))  # 1/16
        d = r(self.m2(r(self.m1(d))))
        sk = r(self.u1(self.up(d))) + b
        return self.head(r(self.d1(sk)))  # 6 maps at 1/4


try:
    torch.manual_seed(0)
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    net = Places()
    params = sum(p.numel() for p in net.parameters())
    print("torch", torch.__version__, "cuda build:", torch.version.cuda, "| params", params)
    assert params == EXPECTED_PARAMS, f"params {params} != {EXPECTED_PARAMS}"
    opt = torch.optim.Adam(net.parameters(), lr=1e-3)
    loss_fn = nn.CrossEntropyLoss()
    losses = []
    for step in range(20):
        x = torch.rand(2, 1, H, W)
        y = torch.randint(0, 6, (2, H // 4, W // 4))
        out = net(x)
        assert out.shape == (2, 6, H // 4, W // 4), f"output shape {tuple(out.shape)}"
        loss = loss_fn(out, y)
        opt.zero_grad()
        loss.backward()
        opt.step()
        losses.append(loss.item())
    assert all(np.isfinite(losses)), "non-finite loss"
    print("trained 20 steps on CPU, loss first %.4f last %.4f" % (losses[0], losses[-1]))
except Exception:
    fail("train")

try:
    net.eval()
    tmp = tempfile.mkdtemp(prefix="smoke-", dir=os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(tmp, "places.onnx")
    x = torch.rand(1, 1, H, W, generator=torch.Generator().manual_seed(1))
    with torch.no_grad():
        ref = net(x).numpy()
    torch.onnx.export(net, (x,), path, input_names=["page"], output_names=["places"], opset_version=17, dynamo=False)
    m = onnx.load(path)
    onnx.checker.check_model(m)
    print("exported ONNX opset", m.opset_import[0].version, "bytes", os.path.getsize(path))
except Exception:
    fail("export")

try:
    sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    got = sess.run(None, {"page": x.numpy()})[0]
    assert got.shape == ref.shape == (1, 6, H // 4, W // 4), f"shapes {got.shape} {ref.shape}"
    diff = float(np.max(np.abs(got - ref)))
    print("onnxruntime", ort.__version__, "max abs diff vs torch %.3e (limit %.0e)" % (diff, TOL))
    assert diff <= TOL, f"diff {diff} > {TOL}"
except Exception:
    fail("onnxruntime")

try:
    import sklearn
    rng = np.random.default_rng(0)
    X = rng.standard_normal((2000, 12))
    y = rng.integers(0, 3, 2000)
    clf = HistGradientBoostingClassifier(max_iter=50, random_state=0).fit(X, y)
    p = clf.predict_proba(X)
    assert p.shape == (2000, 3), f"proba shape {p.shape}"
    worst = float(np.max(np.abs(p.sum(axis=1) - 1.0)))
    print("scikit-learn", sklearn.__version__, "HistGradientBoosting proba sum max deviation %.1e" % worst)
    assert worst <= 1e-9, f"proba sums off by {worst}"
except Exception:
    fail("trees")

print("SMOKE: PASS")
