-- migrations/023_professional_tactical_lineage.sql
-- Fase 1: Linaje táctico profesional y taxonomía ampliada (Liga 1 Scout)

-- 1. Incorporación idempotente de columnas de trazabilidad
ALTER TABLE player_match_stats ADD COLUMN position_source TEXT DEFAULT 'fallback';
ALTER TABLE player_match_stats ADD COLUMN replaced_player_id INTEGER;

-- 2. Taxonomía de Roles en position_role_map
INSERT OR REPLACE INTO position_role_map (code, position_group, role_group) VALUES
-- Full Back
('LB',  'Defender', 'Full Back'),
('RB',  'Defender', 'Full Back'),
('LWB', 'Defender', 'Full Back'),
('RWB', 'Defender', 'Full Back'),

-- Centre Back
('CB',  'Defender', 'Centre Back'),
('LCB', 'Defender', 'Centre Back'),
('RCB', 'Defender', 'Centre Back'),

-- Defensive Mid
('CDM',  'Midfielder', 'Defensive Mid'),
('LDM',  'Midfielder', 'Defensive Mid'),
('RDM',  'Midfielder', 'Defensive Mid'),
('LCDM', 'Midfielder', 'Defensive Mid'),
('RCDM', 'Midfielder', 'Defensive Mid'),

-- Central Mid
('CM',  'Midfielder', 'Central Mid'),
('LCM', 'Midfielder', 'Central Mid'),
('RCM', 'Midfielder', 'Central Mid'),

-- Wide/AM (Mediocampistas y Extremos)
('CAM',  'Midfielder', 'Wide/AM'),
('LAM',  'Midfielder', 'Wide/AM'),
('RAM',  'Midfielder', 'Wide/AM'),
('LCAM', 'Midfielder', 'Wide/AM'),
('LM',   'Midfielder', 'Wide/AM'),
('RM',   'Midfielder', 'Wide/AM'),
('LW',   'Midfielder', 'Wide/AM'),
('RW',   'Midfielder', 'Wide/AM'),
('LWM',  'Midfielder', 'Wide/AM'),
('RWM',  'Midfielder', 'Wide/AM'),
('LW',   'Forward',    'Wide/AM'),
('RW',   'Forward',    'Wide/AM'),

-- Striker (Delanteros y mediocampistas en punta)
('ST', 'Forward',    'Striker'),
('CF', 'Forward',    'Striker'),
('SS', 'Forward',    'Striker'),
('RS', 'Forward',    'Striker'),
('LS', 'Forward',    'Striker'),
('ST', 'Midfielder', 'Striker'),
('CF', 'Midfielder', 'Striker'),
('SS', 'Midfielder', 'Striker'),
('RS', 'Midfielder', 'Striker'),
('LS', 'Midfielder', 'Striker');

-- 3. Recreación de Vista player_role_groups
DROP VIEW IF EXISTS player_role_groups;
CREATE VIEW player_role_groups AS
WITH player_roles AS (
    SELECT 
        p.player_id,
        prm.role_group,
        SUM(COALESCE(pms.minutes_played, 0)) as role_minutes
    FROM players p
    JOIN player_match_stats pms ON p.player_id = pms.player_id
    JOIN position_role_map prm ON pms.position = prm.code AND p.position_group = prm.position_group
    GROUP BY p.player_id, prm.role_group
),
player_totals AS (
    SELECT 
        player_id,
        SUM(role_minutes) as classified_minutes,
        MAX(role_minutes) as max_minutes
    FROM player_roles
    GROUP BY player_id
),
top_roles AS (
    SELECT 
        pr.player_id,
        pr.role_group,
        pt.classified_minutes,
        COUNT(*) OVER (PARTITION BY pr.player_id) as top_role_count
    FROM player_roles pr
    JOIN player_totals pt ON pr.player_id = pt.player_id AND pr.role_minutes = pt.max_minutes
)
SELECT 
    p.player_id,
    CASE 
        WHEN tr.classified_minutes < 180 THEN NULL
        WHEN tr.top_role_count > 1 THEN NULL
        ELSE tr.role_group
    END as role_group,
    COALESCE(tr.classified_minutes, 0) as classified_minutes
FROM players p
LEFT JOIN top_roles tr ON p.player_id = tr.player_id
GROUP BY p.player_id;
