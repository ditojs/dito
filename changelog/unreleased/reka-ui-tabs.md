### Behaviour changes

- **admin:** Tabs are built on `reka-ui`'s `Tabs`. They select on mouse down, and the selected tab has `[data-state='active']` instead of `.dito-tabs__link--active`.
  - Only a real mouse press selects a tab: synthetic clicks, e.g. `click()` in the tests of apps, don't.
  - The tab list is one tab stop, which passes the focus to the selected tab. The arrow keys move between the tabs.
