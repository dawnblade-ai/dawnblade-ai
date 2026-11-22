# H38 — Fai's Fealty (SPXFEALTY / SPXFEALTYCHAIN): fires, changes NOTHING

Patch `H38-fai-fealty-ZERO.patch` (on v6.69): `effects.gatesMetNow` (effPowerNow's gate loop, any op),
`judge.dracGrantFor` -> {uid, own, chain}, reason keys fealtyFirst / fealtyChain.
(a) own gate: the next play's own gated ops opened by the engine's `_drac` stamp (Dragon Power +3{p},
    Art of the Dragon: Fire's dmg 2). Fires ~1 per 32 games.
(b) chain: another held attack's gated ops opened with this attack counted as a Draconic link
    (Hot on Their Heels / Cinderskin / Display Loyalty go again, Phoenix Flame +1). ~11-14 per 32 games.
A/B Fai, 12 seeds, own seat / other chair: off 101/109, (a) 101/109, (a)+(b) 101/109, (a) again 101/110.
Game-by-game (32 games, own seat): IDENTICAL final turn and life with the gates on and off. Trace
(fai-iyslander-1): the only difference is the Fealty activation itself; the stamped attack (Fire Tenet)
plays the same; the go-again it unlocked on Hot on Their Heels is never used, because the card isn't
played that turn.
Root cause: the payoffs Fealty opens are mostly CONDITIONAL GO AGAIN (drac2), and the policy cannot see
conditional go again: `judge.keepsActionPoint` reads printed go again, `_arsGA`, the hero grant and
gaNext/gaNextQ, but never a card's own `conds` with op ["ga"] (drac2, lifeLt, ...). So it neither
sequences for it nor plays the unlocked card. That gap is the real lever, and it is broader than Fai:
Scar for a Scar (lifeLt -> ga), Cinderskin, Hot on Their Heels, Enflame, Display Loyalty.
