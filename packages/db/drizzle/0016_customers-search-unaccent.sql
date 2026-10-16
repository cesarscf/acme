-- Customer search ignores accents and cedillas: "Debora" finds "Débora" and back.
CREATE EXTENSION IF NOT EXISTS unaccent;
