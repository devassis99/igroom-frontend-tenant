# Deploying the tenant app to S3

A static site: the bucket holds the whole app and every deploy is an upload.
CloudFront comes later; everything below is written so that adding it changes
the bucket's permissions and nothing else.

```
push to main → pnpm lint, test → fetch igroom/frontend-tenant → .env.production
             → pnpm build → s3 sync assets/ → s3 cp index.html
```

## The bucket

```bash
export REGION=eu-west-1 BUCKET=igroom-app-tenant

aws s3 mb "s3://$BUCKET" --region "$REGION"

# index.html as BOTH documents. The error document is what makes client-side
# routing work: this app uses createBrowserRouter, so /appointments/42 is a
# real URL the browser will request from S3, and S3 has no such object. Handing
# back index.html lets React Router resolve it. Without this, every deep link
# and every refresh is a 404 page.
aws s3 website "s3://$BUCKET" \
  --index-document index.html \
  --error-document index.html
```

Until CloudFront exists the bucket has to be publicly readable, which means
turning off the account's default block and attaching a read-only policy:

```bash
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

aws s3api put-bucket-policy --bucket "$BUCKET" --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicRead",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::'"$BUCKET"'/*"
  }]
}'
```

The site is then at `http://$BUCKET.s3-website-$REGION.amazonaws.com`. Note
`http` — a website endpoint cannot do HTTPS. That is the main reason to put
CloudFront in front sooner rather than later, along with `app.igroom.app`.

## The secret

One secret per app, holding only what the browser needs: `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_BOOKING_BASE_URL`, `VITE_MAPBOX_ACCESS_TOKEN`.

```bash
aws secretsmanager create-secret --name igroom/frontend-tenant --secret-string '{
  "VITE_API_BASE_URL": "https://api.igroom.app",
  "VITE_GOOGLE_CLIENT_ID": "...apps.googleusercontent.com"
}'
```

None of these are secret — every `VITE_` variable is compiled into the bundle
and served to every visitor. They live in Secrets Manager so they are
maintained in one account next to the backend values they have to agree with,
rather than in three GitHub settings pages. **Never put a secret key here**: it
would be published, not protected.

`deploy/aws-env.sh` writes them to `.env.production`, which `vite build` reads
automatically. It refuses to continue if `VITE_API_BASE_URL` is missing, because
a build without it produces an app that looks perfectly fine and cannot reach
the API.

## IAM

The workflow authenticates with OIDC, so there are no AWS keys in the repo. The
same `igroomGithubDeployRole` the backend uses can serve all four repositories —
its trust policy needs a subject condition per repo — and for this one it needs:

- `secretsmanager:GetSecretValue` on the `igroom/frontend-tenant` ARN
- `s3:PutObject`, `s3:ListBucket` on `arn:aws:s3:::igroom-app-tenant` and `/*`
- `cloudfront:CreateInvalidation`, once there is a distribution

Repository secret: `AWS_ACCOUNT_ID`. Region and bucket are in the workflow's
`env` block.

## Why the upload is in three steps

Order and cache headers are the only things making an in-place replacement of a
running app safe.

1. **`assets/` first, `max-age=31536000, immutable`, never deleted.** Every
   filename there carries a content hash, so it can be cached forever — and old
   files have to survive the deploy, because somebody has the previous
   `index.html` open right now and will keep requesting the chunks it names
   until they reload.
2. **Unhashed root files** (a favicon, `robots.txt`) get five minutes instead.
   An immutable cache on a fixed filename means a change never reaches anyone.
3. **`index.html` last, `no-cache`.** It is the file that names this release's
   asset hashes, so uploading it before its assets exist is a white screen for
   whoever loads the site in between.

Because nothing is deleted, the bucket grows by one build's worth of assets per
deploy. That is deliberate; when it starts to matter, delete objects older than
a few releases rather than adding `--delete` to the sync.

## Three things deliberately not uploaded

- **`*.map`** — this app builds with `sourcemap: true`, and a public bucket
  would serve your full original source to anyone who opens devtools. Drop the
  `--exclude "*.map"` if you would rather have readable stack traces than
  private source, or upload them somewhere private and point an error tracker
  at that.
- **`*.br` and `*.gz`** — `vite-plugin-compression2` pre-compresses at build
  time, but an S3 website endpoint does not negotiate content encoding, so
  those files would just sit there unused. CloudFront compresses on the fly, so
  they stay unnecessary later too.

## When CloudFront arrives

The workflow already invalidates: set the `CLOUDFRONT_DISTRIBUTION_ID`
repository variable and the last step starts running. Nothing else in it
changes.

The bucket, though, should stop being public. Switch the origin to the S3 REST
endpoint with Origin Access Control, re-enable the public access block, and
replace the policy above with one granting `s3:GetObject` to the CloudFront
service principal for that distribution.

One thing to fix at the same time: the S3 error-document trick returns
**HTTP 404** with the app's HTML, so every deep link is a 404 to anything
reading status codes. A CloudFront custom error response mapping 403/404 to
`/index.html` with a **200** is the proper version of the same fallback.
