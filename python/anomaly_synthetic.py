"""Anomaly finder for Roomwise furniture data (IsolationForest).

Run from the project root:
    npm run synthetic            # creates data/synthetic/*.csv (once)
    pip install -r requirements.txt
    python python/anomaly_synthetic.py

Reads data/synthetic/items.csv and rooms.csv, flags unusual furniture items, writes
results/anomalies.csv and results/anomalies.png.
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.ensemble import IsolationForest

DATA = Path("data/synthetic")
OUT = Path("results")
OUT.mkdir(exist_ok=True)

items = pd.read_csv(DATA / "items.csv")
rooms = pd.read_csv(DATA / "rooms.csv")[["room_id", "width_cm", "depth_cm"]]
df = items.merge(rooms, on="room_id", suffixes=("", "_room"))

# Footprint on the plan: items facing East/West are rotated 90 degrees.
rotated = df["facing"].isin(["E", "W"])
df["fp_w"] = df["width_cm"].where(~rotated, df["depth_cm"])
df["fp_h"] = df["depth_cm"].where(~rotated, df["width_cm"])

df["area_m2"] = df["fp_w"] * df["fp_h"] / 10000
df["aspect_ratio"] = df[["fp_w", "fp_h"]].max(axis=1) / df[["fp_w", "fp_h"]].min(axis=1)
left, top = df["x_cm"], df["y_cm"]
right = df["width_cm_room"] - (df["x_cm"] + df["fp_w"])
bottom = df["depth_cm_room"] - (df["y_cm"] + df["fp_h"])
df["dist_to_nearest_wall_cm"] = pd.concat([left, top, right, bottom], axis=1).min(axis=1)
cx = df["x_cm"] + df["fp_w"] / 2 - df["width_cm_room"] / 2
cy = df["y_cm"] + df["fp_h"] / 2 - df["depth_cm_room"] / 2
df["dist_to_center_cm"] = (cx**2 + cy**2) ** 0.5

FEATURES = ["area_m2", "aspect_ratio", "dist_to_nearest_wall_cm", "dist_to_center_cm"]
model = IsolationForest(n_estimators=200, contamination=0.02, random_state=42)
df["anomaly"] = model.fit_predict(df[FEATURES]) == -1
df["anomaly_score"] = -model.score_samples(df[FEATURES])  # higher = more unusual

flagged = df[df["anomaly"]].sort_values("anomaly_score", ascending=False)
cols = ["room_id", "type", "label", *FEATURES, "anomaly_score"]
flagged[cols].to_csv(OUT / "anomalies.csv", index=False)

print(f"{len(df)} items, {len(flagged)} flagged as anomalies ({len(flagged) / len(df):.1%})")
print(flagged[cols].head(10).round(2).to_string(index=False))

fig, ax = plt.subplots(figsize=(7, 5))
ax.scatter(df["area_m2"], df["aspect_ratio"], s=8, alpha=0.35, label="normal")
ax.scatter(flagged["area_m2"], flagged["aspect_ratio"], s=30, color="crimson", label="anomaly")
ax.set_xlabel("Footprint area (m²)")
ax.set_ylabel("Aspect ratio (long side / short side)")
ax.set_title("IsolationForest: unusual furniture items")
ax.legend()
fig.tight_layout()
fig.savefig(OUT / "anomalies.png", dpi=150)
print("Saved results/anomalies.csv and results/anomalies.png")
