# Wisconsin OSB Data Analysis Proposal

Redesigned and copy-edited version of the Victor-Strategies proposal to the
Wisconsin Tribal Nations Advisory Working Group (original draft:
`VS_Proposal_Online_Sports_Betting_Wisconsin_Data_Analysis_DRAFT_061126.doc`).

The economic impact section (Phase II Option) is based on **GEMS** (Gaming
Economic Modeling System) rather than the off-the-shelf software referenced in
the initial draft; methodology language is drawn from
[`docs/methodology.md`](../../docs/methodology.md).

## Regenerating

```bash
pip install python-docx
python3 build_proposal.py
```

Output: `VS_Proposal_Online_Sports_Betting_Wisconsin_Data_Analysis_REVISED_061226.docx`.
All proposal content lives inline in `build_proposal.py`; edit there and
rebuild. Images in `assets/` were extracted from the original `.doc`
(the Philander headshot is center-cropped to square). The table of contents is
a Word field — it populates when the document is opened in Word (or after
right-click → Update Field).
