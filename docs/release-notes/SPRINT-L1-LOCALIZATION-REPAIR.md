# Sprint L1 — Localization Repair

## Fix

Restored the translation sections that were accidentally removed when later locale files replaced earlier cumulative locale files.

The five locale files now retain the cumulative keys for dashboard, notifications, calendar, customers, customer profile, staff and services.

## Root cause

The Staff and Services delivery locale files were based on incomplete snapshots and replaced complete locale files instead of merging new keys. i18next therefore returned the missing key names in the UI.

## Validation

- All five locale files parse as valid JSON.
- All five locales expose the same leaf-key set.
- Dashboard, Calendar, Customers, Customer Profile, Staff and Services translation trees are present.
