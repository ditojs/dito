### Internal

- **admin:** The buttons that `DitoButtons` receives through its slot, e.g. the edit buttons of list items, render without a `.dito-buttons__container` wrapper; the buttons of `buttons` schemas keep it. `DitoCreateButton` renders its button without the `div.dito-create-button` wrapper, with the class `dito-create-button` on the button itself. Check app styles that target these wrappers.
