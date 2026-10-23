### Fixes

- **admin:** Removing an item whose form is open with unsaved changes closes the form without asking to discard them. Before, cancelling that question kept the form open on the removed item, and applying it overwrote the next item with the draft, or added the removed last item again.
