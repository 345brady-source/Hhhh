# 12-05 deferred items (found while building the starters; outside this plan)

1. **Asset updates cannot attach to any holding today.** Every sample fund's holdings (and fund A's) are the engine's
   generated rows with `id: ''` (measured on all 15 sample funds at 2026-12-31). `NS.reports.normalise` drops an asset item
   whose `holdingId` is empty, and the assets section matches items by `h.id`, so a sponsor's photos, wording and figures
   for a property or company cannot be saved against it until holdings carry ids. 12-01 records that plan 11-11 moves
   holdingsAt onto the journal (holdings with ids such as `fa-x`); after 11-11 merges, rerun
   `checks/reports-starters.js` and `checks/reports-xlsx.js` and confirm that `NS.reportsData.holdings` rows carry ids.
   The 12-05 inject case gives each holding row an id in a wrapper over the real figures for that reason. 12-06's
   asset-item editor needs the same ids.
2. **A sponsor's own disclaimer prints as typed.** Every starter puts the tenant's disclaimer first (B2). The sample
   Pellbrook text said "Fund values are estimates until audited"; 12-05 reworded that sample sentence (tenants.js). A real
   sponsor who types "audited" (or any other word the checks forbid) into the disclaimer will see it on every report; no
   screen warns them. Decide at the owner's check whether the settings screen should warn.
3. **mobile/src/core/tenants.js** still holds the old Pellbrook sentence ("estimates until audited"). It is a separate app
   that phase 12 does not load; left unchanged.
