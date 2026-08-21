# AWS S3 Setup Guide (Photo/Voice Note Uploads)

This is a from-scratch guide for setting up AWS S3 so the backend can upload resident-submitted
photos and voice notes and store the resulting URLs on the `ticket` / `ticket_media` rows. Written
assuming you've never used AWS before — every step is spelled out.

You'll end up with four values to paste into `backend/.env`:

```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=
```

**Cost note:** AWS's free tier includes 5GB of S3 storage and 20,000 GET / 2,000 PUT requests per
month for the first 12 months — plenty for development and a demo. Just don't upload huge files.

---

## 1. Create an AWS account

Skip this if you already have one.

1. Go to https://aws.amazon.com/ and click **Create an AWS Account**.
2. You'll need an email, a password, and a credit/debit card (required even to stay within the free
   tier — AWS just won't charge it unless you exceed free-tier limits).
3. Choose the **Basic support - Free** plan when asked.
4. Once signed up, log into the [AWS Console](https://console.aws.amazon.com/).

---

## 2. Create the S3 bucket

1. In the AWS Console search bar at the top, type **S3** and open it.
2. Click **Create bucket**.
3. **Bucket name**: must be globally unique across *all* AWS accounts, not just yours — e.g.
   `simplifix-media-yourname-2026`. Lowercase letters, numbers, and hyphens only. Write this down —
   it's your `S3_BUCKET_NAME`.
4. **AWS Region**: pick whichever is closest to you (e.g. `us-east-1`). Write down the region code
   shown in parentheses — that's your `AWS_REGION`.
5. **Object Ownership**: leave it on the default, **Bucket owner enforced** (this disables
   per-object ACLs entirely — we don't use those; see step 6 for how the app makes objects public
   instead).
6. **Block Public Access settings for this bucket**: uncheck **Block all public access**. You'll get
   a warning asking you to confirm — check the acknowledgement box. This is safe here because every
   object key is an unguessable UUID (nobody can browse the bucket's contents, only fetch a file if
   they already have its exact URL) — and step 8 below only grants public *read* access, never write.
7. Leave everything else as default (versioning off, default encryption is fine).
8. Click **Create bucket**.

### 2.1 Make uploaded objects publicly readable

The app needs uploaded photos/voice notes to be viewable via a plain URL (no AWS credentials). We
do this with a **bucket policy** (not per-object ACLs — those are disabled by "Bucket owner
enforced" above, which is the modern AWS-recommended default and avoids a whole class of
`AccessDenied` errors).

1. Open your bucket → **Permissions** tab.
2. Scroll to **Bucket policy** → click **Edit**.
3. Paste this in, replacing `YOUR-BUCKET-NAME` with your actual bucket name:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       }
     ]
   }
   ```

4. Click **Save changes**. This only allows anyone to *read* an object if they already know its
   exact key — it grants no write/delete/list access to anyone but your IAM user.

---

## 3. Create an IAM user for the backend

Don't use your root account's credentials in the app — create a dedicated user that can *only*
touch this one bucket.

1. Search for **IAM** in the console search bar and open it.
2. In the left sidebar: **Users** → **Create user**.
3. **User name**: something like `simplifix-backend`.
4. Click **Next**. On the permissions step, choose **Attach policies directly**, but don't pick a
   pre-made policy yet — click **Create policy** instead (opens a new tab) and do step 4 below,
   then come back to this tab and attach it.

### 3.1 Create a scoped-down policy

In the new tab (**IAM → Policies → Create policy**):

1. Switch to the **JSON** editor tab and paste this in, replacing `YOUR-BUCKET-NAME`:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject"],
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       }
     ]
   }
   ```

   This only allows uploading/reading objects inside your bucket — nothing else in your AWS
   account. (No `s3:PutObjectAcl` needed — we're not using per-object ACLs, see step 2.1.)
2. Click **Next**, name it `simplifix-s3-upload-policy`, and click **Create policy**.

### 3.2 Attach it and finish creating the user

1. Back in the **Create user** tab, refresh the policy list, search for
   `simplifix-s3-upload-policy`, check it, click **Next**, then **Create user**.

### 3.3 Generate an access key

1. Click into the user you just created (`simplifix-backend`).
2. Go to the **Security credentials** tab.
3. Under **Access keys**, click **Create access key**.
4. Choose **Application running outside AWS** (or "Local code" — wording varies) as the use case.
5. Click through and **Create access key**.
6. You'll see an **Access key ID** and a **Secret access key**. Copy both now — the secret is only
   shown once. If you lose it, delete the key and generate a new one.

---

## 4. Fill in `backend/.env`

Open `backend/.env` (copy it from `.env.example` first if you haven't already) and fill in the
section already scaffolded there:

```
AWS_ACCESS_KEY_ID=<the access key ID from 3.3>
AWS_SECRET_ACCESS_KEY=<the secret access key from 3.3>
AWS_REGION=<the region code from step 2, e.g. us-east-1>
S3_BUCKET_NAME=<the bucket name from step 2>
```

This file is already gitignored — never commit real AWS keys.

---

## 5. Test it

1. Install the new dependency and start the API (see [setup.md](./setup.md) if you haven't already):
   ```bash
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
2. Open http://localhost:8000/docs.
3. Register/login a test user and click **Authorize** with the token (see [setup.md](./setup.md) → Next Steps).
4. Try `POST /api/v1/uploads`: set `kind` to `photo`, choose an image file, and execute.
5. You should get back `{"url": "https://YOUR-BUCKET-NAME.s3.YOUR-REGION.amazonaws.com/photos/<uuid>.jpg"}`.
   Paste that URL into a browser tab — the image should load directly.
6. If it works, go back to the S3 console → your bucket → you should see a `photos/` folder with
   the uploaded file.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `AccessDenied: ... not authorized to perform: s3:PutObject ... because public ACLs are prevented by the BlockPublicAcls setting` | The app doesn't use ACLs at all (see step 2.1) — this means the request is somehow still sending an ACL, or you're on an older version of `app/core/storage.py`. Make sure `upload_to_s3()` does **not** pass an `ACL=` argument to `put_object`. |
| Uploaded fine, but the returned URL gives `AccessDenied` in the browser | Either (a) the bucket policy from step 2.1 isn't saved/correct — double check the bucket name in the `Resource` ARN matches exactly, or (b) Block Public Access is still on. Bucket → **Permissions** → **Block public access** → **Edit** → uncheck **Block all public access**. Also check the **account-level** Block Public Access settings (S3 console → left sidebar → **Block Public Access settings for this account**) — if that's on, it overrides the bucket-level setting even if the bucket looks unblocked. |
| `AccessControlListNotSupported` | Something (old code, or a manual test) is trying to set an ACL on an object, but Object Ownership is "Bucket owner enforced" (the default here), which disables ACLs entirely. Remove the ACL — public read is handled by the bucket policy instead. |
| `An error occurred (InvalidAccessKeyId)` or `SignatureDoesNotMatch` | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `.env` don't match what AWS issued — re-check for typos or stray whitespace, or generate a fresh key pair (step 3.3) if you're not sure. |
| `NoSuchBucket` | `S3_BUCKET_NAME` in `.env` doesn't match the bucket you created, or has a typo. Bucket names are case-sensitive. |
| `IllegalLocationConstraintException` or requests hang/timeout | `AWS_REGION` in `.env` doesn't match the region the bucket actually lives in. Check the bucket's region in the S3 console (shown in the bucket list) and fix `.env`. |
| `415 Unsupported Media Type` from `POST /api/v1/uploads` | The file's content-type isn't in the allowed list in `app/core/storage.py` (JPEG/PNG/WebP for photos, m4a/mp3/aac for voice notes). Expected for e.g. a HEIC photo — convert it or extend the allowlist. |
| `413` from `POST /api/v1/uploads` | File is over the 10MB (photo) / 15MB (voice note) limit set in `app/core/storage.py`. |

## Next steps

Once this works locally, note that these are personal/dev credentials tied to your AWS account —
for a shared team environment or production, create a separate IAM user (and possibly a separate
bucket) so credentials aren't tied to one person, and consider AWS Secrets Manager or your
deployment platform's secret store instead of a plain `.env` file.
