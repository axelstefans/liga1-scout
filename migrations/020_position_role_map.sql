-- Migration 020: Position Role Map and Player Role Groups View

CREATE TABLE IF NOT EXISTS position_role_map (
    code TEXT NOT NULL,
    position_group TEXT NOT NULL,
    role_group TEXT NOT NULL,
    PRIMARY KEY (code, position_group)
);

INSERT OR REPLACE INTO position_role_map (code, position_group, role_group) VALUES
('CB', 'Defender', 'Centre Back'),
('LCB', 'Defender', 'Centre Back'),
('RCB', 'Defender', 'Centre Back'),
('LB', 'Defender', 'Full Back'),
('RB', 'Defender', 'Full Back'),
('LWB', 'Defender', 'Full Back'),
('RWB', 'Defender', 'Full Back'),
('LDM', 'Midfielder', 'Defensive Mid'),
('RDM', 'Midfielder', 'Defensive Mid'),
('CDM', 'Midfielder', 'Defensive Mid'),
('LCM', 'Midfielder', 'Central Mid'),
('RCM', 'Midfielder', 'Central Mid'),
('CAM', 'Midfielder', 'Attacking Mid'),
('LAM', 'Midfielder', 'Attacking Mid'),
('RAM', 'Midfielder', 'Attacking Mid'),
('LM', 'Midfielder', 'Attacking Mid'),
('RM', 'Midfielder', 'Attacking Mid');

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
        WHEN tr.classified_minutes < 270 THEN NULL
        WHEN tr.top_role_count > 1 THEN NULL
        ELSE tr.role_group
    END as role_group,
    COALESCE(tr.classified_minutes, 0) as classified_minutes
FROM players p
LEFT JOIN top_roles tr ON p.player_id = tr.player_id
GROUP BY p.player_id;
