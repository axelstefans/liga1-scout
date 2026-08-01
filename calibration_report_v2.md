# Backtest Calibration Report V2 (Multiplicative Formula)

## 1. Global Metrics

- **Home Win**: Brier Score = 0.2292 | Log-Loss = 0.6531
- **Over 2.5**: Brier Score = 0.3228 | Log-Loss = 0.8970

## 2. Model Scale Gap (Average Expected vs Actual Goals)

- **Average Projected Total Goals per Match (Lambda sum)**: 1.582
- **Average Actual Total Goals per Match**: 2.597

## 3. Calibration Table: Home Win

| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff |
|--------------------|-------|--------------------|------------------|------|
| [0% - 10%] | 19 | 8.0% | 15.8% | -7.8% |
| [10% - 20%] | 82 | 15.5% | 35.4% | -19.9% |
| [20% - 30%] | 179 | 25.5% | 27.9% | -2.5% |
| [30% - 40%] | 223 | 34.8% | 41.7% | -6.9% |
| [40% - 50%] | 204 | 44.9% | 57.8% | -12.9% |
| [50% - 60%] | 165 | 54.7% | 61.8% | -7.2% |
| [60% - 70%] | 110 | 64.7% | 80.9% | -16.2% |
| [70% - 80%] | 49 | 73.5% | 79.6% | -6.1% |
| [80% - 90%] | 1 | 80.4% | 100.0% | -19.6% |

## 4. Calibration Table: Over 2.5

| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff |
|--------------------|-------|--------------------|------------------|------|
| [0% - 10%] | 105 | 6.8% | 34.3% | -27.5% |
| [10% - 20%] | 403 | 15.5% | 46.7% | -31.1% |
| [20% - 30%] | 353 | 24.7% | 51.3% | -26.5% |
| [30% - 40%] | 127 | 33.7% | 56.7% | -23.0% |
| [40% - 50%] | 28 | 43.9% | 67.9% | -23.9% |
| [50% - 60%] | 10 | 54.4% | 50.0% | +4.4% |
| [60% - 70%] | 6 | 62.8% | 100.0% | -37.2% |
