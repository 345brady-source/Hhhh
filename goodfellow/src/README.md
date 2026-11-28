# Goodfellow Capital Markets website (version 3): Cloudflare

## Publish
1. In the Cloudflare dashboard, open Workers & Pages, click Create, choose the Pages tab, then Upload assets (Direct Upload).
2. Upload goodfellow-website-v3-cloudflare.zip as a new deployment of your existing project. The homepage index.html sits at the top level, with one folder per page (about/, investment-banking/, 1031-exchanges/, contact/, disclosures/), plus sitemap.xml and robots.txt.
3. Open the project's Custom domains tab, add goodfellowcm.com (and www.goodfellowcm.com if wanted) and follow the DNS prompts. Cloudflare issues the SSL certificate automatically.

## Contact forms
The Contact and Investment Banking forms email every submission to Bsmith@goodfellowcm.com through FormSubmit (formsubmit.co).
1. After the site is live, submit the Contact form once yourself.
2. FormSubmit sends a one-time activation email to Bsmith@goodfellowcm.com. Click Activate Form. That first test submission is not delivered.
3. Submit again. From now on, every submission arrives by email with a subject line naming the form, and replying goes straight to the sender.

Optional: the activation email includes a random alias for the address. To keep the address out of the page source, replace Bsmith@goodfellowcm.com in index.html (search for FORM_EMAIL) with that alias and re-upload.

## Google Search Console
Each page has its own address, title, description and canonical tag:
https://goodfellowcm.com/
https://goodfellowcm.com/about/
https://goodfellowcm.com/investment-banking/
https://goodfellowcm.com/1031-exchanges/
https://goodfellowcm.com/contact/
https://goodfellowcm.com/disclosures/

1. In Search Console, add a Domain property for goodfellowcm.com. Verify it with the TXT record Google gives you, added in Cloudflare DNS (Search Console can also add it for you through Cloudflare).
2. Under Sitemaps, submit: sitemap.xml
3. Under URL inspection, inspect each address above and click Request indexing.

## Email signature
After this version is uploaded, open https://goodfellowcm.com/email/brady-smith/ and click Copy signature, then paste it into your email program's signature settings.
The logo loads from https://goodfellowcm.com/images/goodfellow-email-logo.png, so keep that file on the site. The signature page is hidden from search engines.

## Resume uploads (Careers page)
Each job listing has an Upload resume form that emails the candidate's resume as an attachment to info@goodfellowcm.com through FormSubmit (PDF or Word, 10 MB max).
The first upload after going live sends a one-time activation email to info@goodfellowcm.com. Click Activate Form, then resumes arrive as attachments from then on.
