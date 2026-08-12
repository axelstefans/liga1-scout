# Backtest Calibration Report V3 (Multiplicative + Scaled xG)

## 1. Global Metrics

- **Home Win**: Brier Score = 0.2222 | Log-Loss = 0.6372
- **Over 2.5**: Brier Score = 0.2627 | Log-Loss = 0.7271

## 2. Model Scale Gap (Average Expected vs Actual Goals)

- **Average Projected Total Goals per Match (Lambda sum)**: 2.247
- **Average Actual Total Goals per Match**: 2.597

## 3. Calibration Table: Home Win

| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff |
|--------------------|-------|--------------------|------------------|------|
| [0% - 10%] | 17 | 7.6% | 11.8% | -4.1% |
| [10% - 20%] | 75 | 15.7% | 34.7% | -19.0% |
| [20% - 30%] | 129 | 25.4% | 24.0% | +1.4% |
| [30% - 40%] | 182 | 35.0% | 44.5% | -9.5% |
| [40% - 50%] | 177 | 45.0% | 41.2% | +3.7% |
| [50% - 60%] | 179 | 54.8% | 63.7% | -8.9% |
| [60% - 70%] | 155 | 64.9% | 64.5% | +0.3% |
| [70% - 80%] | 108 | 74.7% | 80.6% | -5.9% |
| [80% - 90%] | 10 | 80.8% | 100.0% | -19.2% |
| [90% - 100%] | 0 | N/A | N/A | N/A |

## 4. Calibration Table: Over 2.5

| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff |
|--------------------|-------|--------------------|------------------|------|
| [0% - 10%] | 22 | 7.7% | 27.3% | -19.6% |
| [10% - 20%] | 74 | 15.9% | 37.8% | -21.9% |
| [20% - 30%] | 207 | 25.9% | 41.1% | -15.2% |
| [30% - 40%] | 295 | 35.1% | 52.2% | -17.1% |
| [40% - 50%] | 266 | 45.0% | 49.6% | -4.6% |
| [50% - 60%] | 126 | 54.0% | 59.5% | -5.5% |
| [60% - 70%] | 36 | 64.2% | 61.1% | +3.1% |
| [70% - 80%] | 6 | 75.0% | 83.3% | -8.3% |
| [80% - 90%] | 0 | N/A | N/A | N/A |
| [90% - 100%] | 0 | N/A | N/A | N/A |
