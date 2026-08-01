# Backtest Calibration Report

## 1. Global Metrics

- **Home Win**: Brier Score = 0.2644 | Log-Loss = 0.7244
- **Over 2.5**: Brier Score = 0.3280 | Log-Loss = 0.8949

## 2. Per-Season Trend

| Season | Matches | Home Win Brier | Home Win LogLoss | Over 2.5 Brier | Over 2.5 LogLoss |
|--------|---------|----------------|------------------|----------------|------------------|
| 48078 | 261 | 0.2734 | 0.7468 | 0.3250 | 0.9081 |
| 57741 | 297 | 0.2664 | 0.7272 | 0.3416 | 0.9348 |
| 70962 | 313 | 0.2516 | 0.6956 | 0.3335 | 0.8968 |
| 88529 | 161 | 0.2714 | 0.7389 | 0.2970 | 0.7958 |

## 3. Calibration Table: Home Win

| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff (Pred - Actual) |
|--------------------|-------|--------------------|------------------|----------------------|
| [0% - 10%] | 0 | N/A | N/A | N/A |
| [10% - 20%] | 64 | 17.3% | 26.6% | -9.3% |
| [20% - 30%] | 388 | 25.8% | 35.1% | -9.2% |
| [30% - 40%] | 409 | 34.6% | 57.7% | -23.1% |
| [40% - 50%] | 160 | 43.9% | 79.4% | -35.4% |
| [50% - 60%] | 11 | 52.0% | 72.7% | -20.8% |
| [60% - 70%] | 0 | N/A | N/A | N/A |
| [70% - 80%] | 0 | N/A | N/A | N/A |
| [80% - 90%] | 0 | N/A | N/A | N/A |
| [90% - 100%] | 0 | N/A | N/A | N/A |

## 4. Calibration Table: Over 2.5

| Probability Bucket | Count | Avg Predicted Prob | Actual Frequency | Diff (Pred - Actual) |
|--------------------|-------|--------------------|------------------|----------------------|
| [0% - 10%] | 18 | 9.3% | 55.6% | -46.3% |
| [10% - 20%] | 502 | 16.3% | 46.0% | -29.7% |
| [20% - 30%] | 433 | 23.9% | 49.9% | -26.0% |
| [30% - 40%] | 62 | 32.2% | 61.3% | -29.1% |
| [40% - 50%] | 17 | 42.9% | 70.6% | -27.7% |
| [50% - 60%] | 0 | N/A | N/A | N/A |
| [60% - 70%] | 0 | N/A | N/A | N/A |
| [70% - 80%] | 0 | N/A | N/A | N/A |
| [80% - 90%] | 0 | N/A | N/A | N/A |
| [90% - 100%] | 0 | N/A | N/A | N/A |

## 5. Summary & Analysis

### Home Win Calibration Analysis
- **[10% - 20%] (Underconfident)**: Predicted ~17.3% but occurred 26.6% of the time.
- **[20% - 30%] (Underconfident)**: Predicted ~25.8% but occurred 35.1% of the time.
- **[30% - 40%] (Underconfident)**: Predicted ~34.6% but occurred 57.7% of the time.
- **[40% - 50%] (Underconfident)**: Predicted ~43.9% but occurred 79.4% of the time.

### Over 2.5 Calibration Analysis
- **[10% - 20%] (Underconfident)**: Predicted ~16.3% but occurred 46.0% of the time.
- **[20% - 30%] (Underconfident)**: Predicted ~23.9% but occurred 49.9% of the time.
- **[30% - 40%] (Underconfident)**: Predicted ~32.2% but occurred 61.3% of the time.
