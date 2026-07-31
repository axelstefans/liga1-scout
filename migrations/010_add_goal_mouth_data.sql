-- Migration 010: Añadir columnas para almacenar datos de la ubicación exacta en la portería

ALTER TABLE player_shots ADD COLUMN goal_mouth_x REAL;
ALTER TABLE player_shots ADD COLUMN goal_mouth_y REAL;
ALTER TABLE player_shots ADD COLUMN goal_mouth_z REAL;
ALTER TABLE player_shots ADD COLUMN goal_mouth_location TEXT;
