# Wisconsin OSB Data Analysis Proposal

Redesigned and copy-edited version of the Victor-Strategies proposal to the
Wisconsin Tribal Nations Advisory Working Group (original draft:
`VS_Proposal_Online_Sports_Betting_Wisconsin_Data_Analysis_DRAFT_061126.doc`).

The economic impact section (Phase II Option) is based on **GEMS** (Gaming
Economic Modeling System) rather than the off-the-shelf software referenced in
the initial draft; methodology language is drawn from
[`docs/methodology.md`](../../docs/methodology.md).

## Drafts

- `build_proposal.py` → `VS_Proposal_..._REVISED_061226.docx` — the redesigned
  and copy-edited draft.
- `build_proposal_v2.py` → `VS_Proposal_..._REVISED_v2_061226.docx` — an
  alternate draft restructured for persuasion: an executive summary that leads
  with independence, qualifications mapped to the three RFP phases (with a
  Choctaw Nation case-study box), the Indiana forecast-vs.-actuals track
  record, an illustrative GEMS table for Wisconsin (computed from
  `online_gambling_multipliers_2023.csv` using the formula in
  `10_casino_impact_model.R`), the complementary-demand finding stated up
  front, a combined engagement timeline, explicit combined-engagement discount
  language, and a fact-based summary. The full chronological engagement
  history moves to Appendix K. Unchanged sections are imported from
  `build_proposal.py`.

## Regenerating

```bash
pip install python-docx
python3 build_proposal.py      # original revised draft
python3 build_proposal_v2.py   # alternate v2 draft
```

All proposal content lives inline in the build scripts; edit there and
rebuild. Images in `assets/` were extracted from the original `.doc`
(the Philander headshot is center-cropped to square). The table of contents is
a Word field — it populates when the document is opened in Word (or after
right-click → Update Field).
