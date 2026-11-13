# WASTA Stock Room

Live inventory for WASTA Apparel: every design, color and size in one place.
The website is hosted free on GitHub Pages. The stock counts live in a Supabase
database, so when anyone on the team changes a count, everyone sees it within a
few seconds.

- **Passkey:** needed to open the site and see stock.
- **Team PIN:** needed to change counts or add and delete pieces.

Neither code is stored in this repository. They live only in the Supabase
database, so it's safe for this repository to be public.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page itself |
| `stock.js` | Everything the page does: loading stock, +/− buttons, filters, adding pieces |
| `stock.css` | The look: colors, fonts, the winter banner |
| `config.js` | Which Supabase project to use (URL and publishable key, both safe to be public) |
| `logo.png` | WASTA logo |
| `supabase/setup.sql` | Rebuilds the database from scratch if you ever need a new Supabase project |

## Change something on the website

1. Open the file on GitHub and click the pencil icon (**Edit this file**).
2. Make the change and click **Commit changes**.
3. GitHub Pages republishes the site in about a minute.

## Change the passkey or team PIN

In Supabase, open **SQL Editor > New query**, paste one of these with your new
code, and click **Run**:

```sql
update private.secrets set value = 'new-passkey' where key = 'view_code';
update private.secrets set value = '123456' where key = 'pin';
```

Changing the passkey locks every device until people enter the new one.

## Starting over with a new Supabase project

1. Create a project at supabase.com.
2. Open `supabase/setup.sql`, replace `CHANGE-ME-PIN` and `CHANGE-ME-PASSKEY`
   with your own codes, and run the whole file in the SQL Editor.
3. Put the new Project URL and publishable key in `config.js`.

Free Supabase projects pause after about a week with no visits. If the site
says it can't reach stock, open the project in Supabase and click **Restore**.
