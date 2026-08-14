# Liga 1 Scout ⚽📊

Liga 1 Scout is a comprehensive football analytics and player scouting dashboard. Designed to provide deep tactical insights, it processes raw match data into actionable intelligence through advanced metrics, spatial mapping, and Expected Goals (xG) models.

Whether you are a scout, analyst, or football enthusiast, this tool offers an intuitive interface to evaluate player performances, analyze movement profiles, and discover hidden talent.

## ✨ Key Features

* **Advanced Player Search:** Quickly locate players across the league with rich profiles including position, team affiliation, and market values.
* **Spatial Analytics (Heatmaps & Shotmaps):** Visualize a player's exact zones of influence and shot locations, augmented by our custom Machine Learning xG (Expected Goals) pipeline.
* **Granular Match & Season Stats:** Dive deep into appearances, passing accuracy, duels won, defensive actions, and per-match performance ratings.
* **League Rankings:** Filter and rank the top-performing players across various statistical categories.

## 🛠️ Tech Stack

This project is structured as a decoupled full-stack application:

**Frontend:**
* **React 18** (TypeScript)
* **Vite** (Build Tool)
* **Tailwind CSS** (Styling)
* **Recharts** (Data Visualization)

**Backend & Data:**
* **FastAPI** (High-performance Python API)
* **SQLite** (Embedded Database)
* **Pandas / Numpy** (Data processing)
* **Scikit-Learn / Joblib** (Expected Goals ML pipeline)

---

## 🚀 Local Setup & Installation

### Prerequisites
* **Node.js** (v18+ recommended)
* **Python** (v3.10+ recommended)

### 1. Clone the Repository
```bash
git clone https://github.com/axelstefans/liga1-scout.git
cd liga1-scout