# Spec 003: React Frontend Dashboard

## Goal
Build a React + Vite + Tailwind + Recharts frontend dashboard for Liga 1 Peruana player analytics.

## Design Direction
- **Style**: Editorial minimalist style on light background. No dark mode.
- **Palette**:
  - Background: `#FAFAF7` (cream white)
  - Primary Text: `#0D1B2A` (navy)
  - Accent/Charts: `#1B4F8A` (navy blue)
  - Card Background: `#FFFFFF`
  - Borders: `#E8E8E0`
- **Typography**: Bold large display font for player names; clean sans-serif for data.

## Layout Structure (Player Profile Page)
Grid layout containing:
1. **Player Header**: Name (bold/large), team, position, nationality, age, shirt number, team logo.
2. **Top Strengths Chips**: Quick highlights.
3. **Attribute Radar Chart**: Attacking, technical, physical categories.
4. **Season Stats**: Horizontal bar percentiles vs league peers.
5. **Recent Form Strip**: Last 5 matches with rating and result.
6. **Match-by-Match Stats**: Table of recent matches.
7. **League Distribution Scatter Plot**.
8. **Position Profile Scatter Plot**.
9. **Player Similarity Section**.

## Technical Constraints
- **Framework**: React + Vite
- **Styling**: Tailwind CSS
- **Data Fetching**: React Query fetching from `http://localhost:8000`
- **Charts**: Recharts
- **Data Source**: Live API only. No mock data.
