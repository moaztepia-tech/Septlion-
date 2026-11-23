# Deploying www.septlion.com

> **بالعربية باختصار:** يوجد الآن طريق واحد فقط لتغيير الموقع، وهو workflow اسمه "Deploy Septlion to Hostinger" ويُشغَّل يدوياً من تبويب Actions.
> 1. شغّله أولاً بوضع **plan**. هذا الوضع لا يغيّر أي شيء، ويعرض لك قائمة بالملفات الحية التي ستُستبدَل، ويعطيك رقم خطة (plan id).
> 2. إذا وافقت على القائمة، شغّله بوضع **publish** وضع فيه رقم الخطة. سيأخذ نسخة احتياطية من كل ملف سيتغيّر، ثم يرفع الملفات ويتحقق منها، وإذا فشل أي فحص يرجع للنسخة السابقة تلقائياً.
> 3. للتراجع في أي وقت: شغّله بوضع **rollback**.
>
> لا يُحذف أي ملف من الخادم أبداً.

## The one release path

`.github/workflows/deploy-hostinger.yml` is the only workflow that writes to
`public_html` on Hostinger. It starts only by hand (Actions, then "Deploy
Septlion to Hostinger", then "Run workflow"). Pushes and commit-message tags
such as `[approved-full-release]` or `[smart-need-only]` no longer deploy
anything.

| Input | Values | Meaning |
|---|---|---|
| `mode` | `plan` (default), `publish`, `rollback` | What to do |
| `site` | `nextjs` (default), `approved-client`, `customer-client`, `platform` | What to publish: the platform in `apps/web`, the archived live client in `sites/approved-client`, the new-app interface at `/` that sends requests to the platform (`sites/customer-client`, see its README), or `platform`: the `apps/web` pages (command center, accounts, offers) behind that interface, keeping its home page, routing file and bridge |
| `plan_id` | text | Required for `publish`: the id printed by the plan run |
| `backup_name` | text | Optional for `rollback`: which backup to restore (empty means the latest) |
| `full_scan` | `false` (default), `true` | Off: read and back up only the live copies of the files in the package (a minute or two; same plan id). On: also scan and back up all of `public_html` (10 to 20 minutes) and list the files the package leaves untouched |

### 1. Plan (changes nothing)

Run with `mode = plan` and the `site` you want. The job builds the package,
downloads the live copy of every file in it (all live files with
`full_scan`), and writes a table to the run summary:

* **New files**: these are added.
* **Replaced live files**: these are overwritten. This is the list to read
  carefully. If the live home page (`index.html`) is listed, the current live
  home page will be replaced.
* **Kept untouched**: live files that are not in the package. They stay as they are.
  They are counted only with `full_scan`; a release never writes them either way.
* **Plan id**: a short code for "replace exactly these live files, in exactly
  their current versions".

The plan run also stores the full live site as an artifact
(`live-before.tar.gz`, kept for 90 days).

### 2. Publish (with the plan id)

Run again with `mode = publish`, the same `site` and `plan_id`. The job:

1. Downloads the live site again and recomputes the plan. If any live file
   that would be replaced has changed since the plan, it stops before changing
   anything (**SAFETY STOP**).
2. Stores a **full backup** of `public_html`, both as a workflow artifact and
   on the server at `/domains/septlion.com/septlion-release-backups/` (outside
   the public web root). It reads the server copy back and checks its SHA-256
   before uploading anything.
3. Uploads only new and changed files, each to a temporary name and then
   renamed into place, and reads every file back. `index.html` goes last.
4. Checks the public site (`/` and every top-level page in the package must
   return 200, and `/` must serve the new `index.html`).
5. If any step fails, it **restores the backup automatically**: replaced files
   get their old content back, and added files are renamed to
   `*.rolled-back-<run>` (not deleted).

The summary ends with the backup name to use for a rollback.

### 3. Rollback

Run with `mode = rollback` (and optionally `backup_name`). The job first saves
the current state as another backup (`…-before-rollback-run<id>`), then
restores the chosen backup the same way as the automatic restore.

## Safety rules

* Nothing is ever deleted on the server. The release script has no delete
  call, and a test checks this.
* Hidden files such as `.htaccess` are fetched directly even if the FTP
  listing hides them, so they are backed up and counted as replaced.
* FTPS verifies the CA chain and hostname before login, using the same
  `hstgr.io` rule as the successful 2026-11-01 client release.
* One release at a time (`concurrency: septlion-production`).
* The script is tested against a fake FTP server on every run:
  `python3 -m unittest discover -s tests -p 'hostinger_release_test.py'`.

## What is live today, and the decision before the first platform release

On 2026-11-01 the "Publish approved SEPTLION client" workflow put a standalone
client (home page, Arabic intake engine `intake.js`, product catalog, icons)
at the root of the site. That client is not built from `apps/web`. It is now
archived byte for byte in `sites/approved-client/` (see its README), so it can
be republished with `site = approved-client` at any time.

Publishing `site = nextjs` replaces that client's `index.html` with the
platform home page. The plan will list it under "Replaced live files". That is
the decision point. The old file stays in the backup and in
`sites/approved-client/`, and `intake.js` and `data/products.json` are kept
because the platform package does not contain them.

The Smart Need (Gemini) patch never reached the live site (every run stopped
before upload), so no live code depends on it.

## Other workflows that touch Hostinger

* `deploy-hostinger-preview.yml` publishes only to
  `public_html/preview/septlion-customer-v2/` from branch `septlion-customer-v2`.
  It cannot touch the main site.
* `approved-client-hostinger.yml` exists only on branch
  `deploy/approved-client-20261101` and runs on pushes to that branch. Don't
  push to that branch. Its client is archived in `sites/approved-client/`, so
  the branch can be retired.
